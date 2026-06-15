/**
 * Estate field-capture + applicant-identity repository.
 *
 * Backs two estate-manager router surfaces with real, tenant-scoped Postgres:
 *   1. STAFF FIELD CAPTURES (migration 0326 `field_captures`) — the offline
 *      sink for the staff-mobile sync queue (attendance / task_ack / incident /
 *      shift_report). Idempotent on (tenant_id, client_id) so an at-least-once
 *      flush re-POST absorbs into the same row instead of duplicating.
 *   2. APPLICANT IDENTITY (migration 0327 `applicant_kyc` + `applicant_profile`)
 *      — the renter-applicant KYC + profile + notification-preference surface
 *      for the tenant-mobile app. A renter only ever sees their own record.
 *
 * RLS ENFORCEMENT (why every method wraps in `withTenantContext`)
 * ──────────────────────────────────────────────────────────────
 * The estate-manager router resolves its handle from the composition-root
 * registry (`services.db`) — the PROCESS-SINGLETON drizzle client, which is
 * NOT wrapped in the per-request tenant transaction `databaseMiddleware`
 * establishes (that middleware is not mounted on this router). Running a bare
 * write on the singleton would leave `app.current_tenant_id` UNBOUND, so the
 * FORCE-RLS policy predicate (`tenant_id = current_setting(...)`) would be NULL
 * and — under a non-BYPASS role — silently drop the write while the INSERT
 * still "succeeds". That is exactly the fake-success this work must avoid.
 *
 * `withTenantContext(db, tenantId, fn)` opens a transaction and binds
 * `SET LOCAL app.current_tenant_id` (+ `app.tenant_id`, `app.is_service_role`
 * = false) before `fn` runs, so the policy fires. A write whose row tenant_id
 * does not match the bound GUC is rejected by the policy's WITH CHECK and
 * SURFACES as an error — never a silent no-op. We additionally pass tenant_id
 * explicitly in every statement (belt-and-braces).
 *
 * No money columns are touched anywhere here; any money these flows imply still
 * routes through the gated verbs + LedgerService (CLAUDE.md hard rule).
 */

import { sql } from 'drizzle-orm';
import { withTenantContext } from '@bossnyumba/database';

/** Minimal drizzle handle this repo needs: `.transaction` (via withTenantContext). */
export type RepoDb = Parameters<typeof withTenantContext>[0];

/**
 * Normalise a drizzle `execute()` result to a row array. postgres-js returns
 * the rows array directly; node-postgres returns `{ rows }`. Mirrors the
 * established `rowsOf` idiom in `composition/durable-wake-store.ts`.
 */
function rowsOf(result: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result as ReadonlyArray<Record<string, unknown>>;
  }
  const wrapped = result as { rows?: ReadonlyArray<Record<string, unknown>> };
  return wrapped?.rows ?? [];
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Field captures (migration 0326)
// ───────────────────────────────────────────────────────────────────────────

export type CaptureType =
  | 'attendance'
  | 'task_ack'
  | 'incident'
  | 'shift_report';

export interface FieldCaptureInput {
  readonly tenantId: string;
  readonly staffId: string;
  /** Client-supplied offline-queue id — the idempotency key. */
  readonly clientId: string;
  readonly captureType: CaptureType;
  readonly propertyId?: string | null;
  readonly unitId?: string | null;
  readonly capturedAt?: string | null;
  readonly body: Record<string, unknown>;
}

export interface FieldCaptureRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly clientId: string;
  readonly captureType: CaptureType;
  readonly staffId: string;
  readonly propertyId: string | null;
  readonly unitId: string | null;
  readonly body: Record<string, unknown>;
  readonly capturedAt: string | null;
  readonly createdAt: string;
  /** True when this POST matched an existing (tenant_id, client_id) row. */
  readonly deduped: boolean;
}

function rowToCapture(
  row: Record<string, unknown>,
  deduped: boolean,
): FieldCaptureRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    clientId: String(row.client_id),
    captureType: String(row.capture_type) as CaptureType,
    staffId: String(row.staff_id),
    propertyId: row.property_id == null ? null : String(row.property_id),
    unitId: row.unit_id == null ? null : String(row.unit_id),
    body:
      typeof row.body === 'string'
        ? (JSON.parse(row.body) as Record<string, unknown>)
        : ((row.body ?? {}) as Record<string, unknown>),
    capturedAt: row.captured_at == null ? null : String(row.captured_at),
    createdAt: String(row.created_at),
    deduped,
  };
}

/** Filters for the tenant-scoped field-capture read-back surface. */
export interface FieldCaptureListFilter {
  readonly tenantId: string;
  /** Restrict to one capture type (e.g. 'incident' for the incidents panel). */
  readonly captureType?: CaptureType;
  /** Restrict to one property. */
  readonly propertyId?: string | null;
  /** Inclusive lower bound on captured_at (falls back to created_at). ISO. */
  readonly fromDate?: string | null;
  /** Inclusive upper bound on captured_at (falls back to created_at). ISO. */
  readonly toDate?: string | null;
  /** Page size (1..200). */
  readonly limit?: number;
}

export interface EstateFieldIdentityRepo {
  saveFieldCapture(input: FieldCaptureInput): Promise<FieldCaptureRecord>;
  /**
   * Tenant-scoped read-back of persisted field captures (the owner/manager
   * projection that closes the worker→owner capture loop). Bound by the RLS
   * tenant GUC via withTenantContext; ordered newest-first.
   */
  listFieldCaptures(
    filter: FieldCaptureListFilter,
  ): Promise<ReadonlyArray<FieldCaptureRecord>>;
  // KYC
  submitKyc(input: KycSubmissionInput): Promise<KycRecord>;
  getKycStatus(
    tenantId: string,
    applicantId: string,
    kycId: string,
  ): Promise<KycRecord | null>;
  // Profile
  upsertProfile(input: ProfileUpsertInput): Promise<ProfileRecord>;
  updateNotificationPrefs(
    input: NotificationPrefsInput,
  ): Promise<ProfileRecord>;
  getProfile(
    tenantId: string,
    applicantId: string,
  ): Promise<ProfileRecord | null>;
}

// ───────────────────────────────────────────────────────────────────────────
// Applicant KYC (migration 0327 `applicant_kyc`)
// ───────────────────────────────────────────────────────────────────────────

export type KycStage = 'submitted' | 'reviewing' | 'approved' | 'rejected';

export interface KycSubmissionInput {
  readonly tenantId: string;
  readonly applicantId: string;
  readonly personal: Record<string, unknown>;
  readonly nida: Record<string, unknown>;
  readonly company: Record<string, unknown>;
  readonly aml: Record<string, unknown>;
}

export interface KycRecord {
  readonly id: string;
  readonly stage: KycStage;
  readonly updatedAt: string;
  readonly rejectionReason: string | null;
}

function rowToKyc(row: Record<string, unknown>): KycRecord {
  return {
    id: String(row.id),
    stage: String(row.stage) as KycStage,
    updatedAt: String(row.updated_at),
    rejectionReason:
      row.rejection_reason == null ? null : String(row.rejection_reason),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Applicant profile (migration 0327 `applicant_profile`)
// ───────────────────────────────────────────────────────────────────────────

export type PreferredLang = 'sw' | 'en';

export interface ProfileUpsertInput {
  readonly tenantId: string;
  readonly applicantId: string;
  readonly companyName?: string | null;
  readonly phone?: string | null;
  readonly preferredLang?: PreferredLang;
}

export interface NotificationPrefsInput {
  readonly tenantId: string;
  readonly applicantId: string;
  readonly newListings: boolean;
  readonly bidUpdates: boolean;
  readonly documentReady: boolean;
  readonly priceAlerts: boolean;
}

export interface NotificationPrefs {
  readonly newListings: boolean;
  readonly bidUpdates: boolean;
  readonly documentReady: boolean;
  readonly priceAlerts: boolean;
}

export interface ProfileRecord {
  readonly id: string;
  readonly applicantId: string;
  readonly companyName: string | null;
  readonly phone: string | null;
  /** Persisted + hydrated — never hard-coded (bilingual hard rule). */
  readonly preferredLang: PreferredLang;
  readonly notifications: NotificationPrefs;
  readonly updatedAt: string;
}

function rowToProfile(row: Record<string, unknown>): ProfileRecord {
  return {
    id: String(row.id),
    applicantId: String(row.applicant_id),
    companyName: row.company_name == null ? null : String(row.company_name),
    phone: row.phone == null ? null : String(row.phone),
    preferredLang: String(row.preferred_lang) as PreferredLang,
    notifications: {
      newListings: row.notif_new_listings === true,
      bidUpdates: row.notif_bid_updates === true,
      documentReady: row.notif_document_ready === true,
      priceAlerts: row.notif_price_alerts === true,
    },
    updatedAt: String(row.updated_at),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Factory
// ───────────────────────────────────────────────────────────────────────────

export function createEstateFieldIdentityRepo(
  db: RepoDb,
): EstateFieldIdentityRepo {
  return {
    async saveFieldCapture(
      input: FieldCaptureInput,
    ): Promise<FieldCaptureRecord> {
      return withTenantContext(db, input.tenantId, async (tx) => {
        const id = newId('fc');
        // Idempotent on (tenant_id, client_id): a re-POSTed offline-queue entry
        // is absorbed (DO NOTHING) and we re-read the canonical row, so the
        // client always receives the persisted record with a `deduped` flag.
        const inserted = await tx.execute(sql`
          INSERT INTO field_captures
            (id, tenant_id, client_id, capture_type, staff_id,
             property_id, unit_id, body, captured_at)
          VALUES (
            ${id}, ${input.tenantId}, ${input.clientId}, ${input.captureType},
            ${input.staffId}, ${input.propertyId ?? null}, ${input.unitId ?? null},
            ${JSON.stringify(input.body ?? {})}::jsonb, ${input.capturedAt ?? null}
          )
          ON CONFLICT (tenant_id, client_id) DO NOTHING
          RETURNING *
        `);
        const insertedRows = rowsOf(inserted);
        if (insertedRows.length > 0) {
          return rowToCapture(insertedRows[0], false);
        }
        // Conflict: the row already exists for this (tenant, client_id). Re-read
        // it so the caller still gets a stable record (idempotent replay).
        const existing = await tx.execute(sql`
          SELECT * FROM field_captures
          WHERE tenant_id = ${input.tenantId} AND client_id = ${input.clientId}
          LIMIT 1
        `);
        const existingRows = rowsOf(existing);
        if (existingRows.length === 0) {
          // Neither inserted nor found ⇒ RLS rejected the write (tenant GUC
          // mismatch). Surface, never fake-success.
          throw new Error(
            'field_capture write was rejected (no row inserted or found) — tenant context mismatch',
          );
        }
        return rowToCapture(existingRows[0], true);
      });
    },

    async listFieldCaptures(
      filter: FieldCaptureListFilter,
    ): Promise<ReadonlyArray<FieldCaptureRecord>> {
      const limit = Math.min(200, Math.max(1, filter.limit ?? 50));
      return withTenantContext(db, filter.tenantId, async (tx) => {
        // Tenant predicate is belt-and-braces alongside the bound RLS GUC. The
        // date window is matched against captured_at when present, else
        // created_at (a capture may arrive without a device timestamp). All
        // values are parameterised — no interpolation.
        const result = await tx.execute(sql`
          SELECT * FROM field_captures
          WHERE tenant_id = ${filter.tenantId}
            AND (${filter.captureType ?? null}::text IS NULL
                 OR capture_type = ${filter.captureType ?? null})
            AND (${filter.propertyId ?? null}::text IS NULL
                 OR property_id = ${filter.propertyId ?? null})
            AND (${filter.fromDate ?? null}::timestamptz IS NULL
                 OR COALESCE(captured_at, created_at) >= ${filter.fromDate ?? null}::timestamptz)
            AND (${filter.toDate ?? null}::timestamptz IS NULL
                 OR COALESCE(captured_at, created_at) <= ${filter.toDate ?? null}::timestamptz)
          ORDER BY COALESCE(captured_at, created_at) DESC, created_at DESC
          LIMIT ${limit}
        `);
        return rowsOf(result).map((row) => rowToCapture(row, false));
      });
    },

    async submitKyc(input: KycSubmissionInput): Promise<KycRecord> {
      return withTenantContext(db, input.tenantId, async (tx) => {
        const id = newId('kyc');
        const result = await tx.execute(sql`
          INSERT INTO applicant_kyc
            (id, tenant_id, applicant_id, stage, personal, nida, company, aml)
          VALUES (
            ${id}, ${input.tenantId}, ${input.applicantId}, 'submitted',
            ${JSON.stringify(input.personal ?? {})}::jsonb,
            ${JSON.stringify(input.nida ?? {})}::jsonb,
            ${JSON.stringify(input.company ?? {})}::jsonb,
            ${JSON.stringify(input.aml ?? {})}::jsonb
          )
          RETURNING *
        `);
        const rows = rowsOf(result);
        if (rows.length === 0) {
          throw new Error(
            'applicant_kyc write was rejected (no row returned) — tenant context mismatch',
          );
        }
        return rowToKyc(rows[0]);
      });
    },

    async getKycStatus(
      tenantId: string,
      applicantId: string,
      kycId: string,
    ): Promise<KycRecord | null> {
      return withTenantContext(db, tenantId, async (tx) => {
        // Anti-IDOR: scope by BOTH the bound tenant (RLS) AND the
        // authenticated applicant_id. A record that is not this renter's
        // returns zero rows ⇒ the route maps that to a uniform 404.
        const result = await tx.execute(sql`
          SELECT * FROM applicant_kyc
          WHERE tenant_id = ${tenantId}
            AND applicant_id = ${applicantId}
            AND id = ${kycId}
          LIMIT 1
        `);
        const rows = rowsOf(result);
        return rows.length === 0 ? null : rowToKyc(rows[0]);
      });
    },

    async upsertProfile(input: ProfileUpsertInput): Promise<ProfileRecord> {
      return withTenantContext(db, input.tenantId, async (tx) => {
        const id = newId('prof');
        // COALESCE keeps existing values when a field is omitted (partial
        // update). preferred_lang is persisted from the body when supplied and
        // hydrated on read — never hard-coded.
        const result = await tx.execute(sql`
          INSERT INTO applicant_profile
            (id, tenant_id, applicant_id, company_name, phone, preferred_lang)
          VALUES (
            ${id}, ${input.tenantId}, ${input.applicantId},
            ${input.companyName ?? null}, ${input.phone ?? null},
            ${input.preferredLang ?? 'en'}
          )
          ON CONFLICT (tenant_id, applicant_id) DO UPDATE SET
            company_name   = COALESCE(EXCLUDED.company_name, applicant_profile.company_name),
            phone          = COALESCE(EXCLUDED.phone, applicant_profile.phone),
            preferred_lang = ${
              input.preferredLang
                ? sql`EXCLUDED.preferred_lang`
                : sql`applicant_profile.preferred_lang`
            },
            updated_at     = NOW()
          RETURNING *
        `);
        const rows = rowsOf(result);
        if (rows.length === 0) {
          throw new Error(
            'applicant_profile write was rejected (no row returned) — tenant context mismatch',
          );
        }
        return rowToProfile(rows[0]);
      });
    },

    async updateNotificationPrefs(
      input: NotificationPrefsInput,
    ): Promise<ProfileRecord> {
      return withTenantContext(db, input.tenantId, async (tx) => {
        const id = newId('prof');
        // Upsert: a renter may set notification prefs before ever touching the
        // profile form, so we create the profile row on first write with
        // language defaulting to 'en' (still persisted, still toggleable later).
        const result = await tx.execute(sql`
          INSERT INTO applicant_profile
            (id, tenant_id, applicant_id,
             notif_new_listings, notif_bid_updates, notif_document_ready, notif_price_alerts)
          VALUES (
            ${id}, ${input.tenantId}, ${input.applicantId},
            ${input.newListings}, ${input.bidUpdates},
            ${input.documentReady}, ${input.priceAlerts}
          )
          ON CONFLICT (tenant_id, applicant_id) DO UPDATE SET
            notif_new_listings   = EXCLUDED.notif_new_listings,
            notif_bid_updates    = EXCLUDED.notif_bid_updates,
            notif_document_ready = EXCLUDED.notif_document_ready,
            notif_price_alerts   = EXCLUDED.notif_price_alerts,
            updated_at           = NOW()
          RETURNING *
        `);
        const rows = rowsOf(result);
        if (rows.length === 0) {
          throw new Error(
            'applicant_profile notification write was rejected (no row returned) — tenant context mismatch',
          );
        }
        return rowToProfile(rows[0]);
      });
    },

    async getProfile(
      tenantId: string,
      applicantId: string,
    ): Promise<ProfileRecord | null> {
      return withTenantContext(db, tenantId, async (tx) => {
        const result = await tx.execute(sql`
          SELECT * FROM applicant_profile
          WHERE tenant_id = ${tenantId} AND applicant_id = ${applicantId}
          LIMIT 1
        `);
        const rows = rowsOf(result);
        return rows.length === 0 ? null : rowToProfile(rows[0]);
      });
    },
  };
}
