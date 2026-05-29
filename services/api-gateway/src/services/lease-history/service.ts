/**
 * Lease history service — append-only chain-of-custody for real-estate.
 *
 * - appendStep(): atomic INSERT bound by tenant + lease + monotonic
 *   step_index. Hash-chains audit_hash from the previous step's
 *   audit_hash, so any tamper is detectable by replay.
 * - showTrace(): returns the chain in step_index order, verifies the
 *   hash linkage, and reports the first broken position.
 *
 * The underlying table is `lease_history` (migration 0287). RLS is
 * FORCE-enabled and the api-gateway middleware binds the
 * `app.current_tenant_id` GUC per request — no app-level tenant filter
 * is required.
 */

import { sql } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';

import { createLogger } from '../../utils/logger.js';
import type {
  AppendLeaseHistoryStepInput,
  LeaseHistoryStep,
  ShowLeaseTraceInput,
  ShowLeaseTraceResult,
} from './types.js';
import {
  LEASE_HISTORY_ACTIONS,
  LEASE_HISTORY_ACTOR_ROLES,
  type LeaseHistoryAction,
  type LeaseHistoryActorRole,
} from './types.js';

const moduleLogger = createLogger('lease-history-service');

const GENESIS_HASH = '';

interface DbExecutor {
  execute(query: unknown): Promise<unknown>;
}

function rowsOf(raw: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as ReadonlyArray<Record<string, unknown>>;
  if (raw && typeof raw === 'object' && 'rows' in raw) {
    const r = (raw as { rows: unknown }).rows;
    if (Array.isArray(r)) return r as ReadonlyArray<Record<string, unknown>>;
  }
  return [];
}

/**
 * Build the audit hash from the canonical step fields + the previous
 * hash. SHA-256 hex, deterministic.
 */
export function computeStepAuditHash(input: {
  readonly leaseId: string;
  readonly stepIndex: number;
  readonly action: LeaseHistoryAction;
  readonly actorId: string;
  readonly actorRole: LeaseHistoryActorRole;
  readonly happenedAt: string;
  readonly photoCid: string | null;
  readonly locationLat: number | null;
  readonly locationLon: number | null;
  readonly amount: number | null;
  readonly currencyCode: string | null;
  readonly prevAuditHash: string;
  readonly provenance: Record<string, unknown>;
}): string {
  const canonical = [
    input.leaseId,
    String(input.stepIndex),
    input.action,
    input.actorId,
    input.actorRole,
    input.happenedAt,
    input.photoCid ?? '',
    input.locationLat == null ? '' : input.locationLat.toFixed(6),
    input.locationLon == null ? '' : input.locationLon.toFixed(6),
    input.amount == null ? '' : input.amount.toFixed(2),
    input.currencyCode ?? '',
    input.prevAuditHash,
    JSON.stringify(input.provenance ?? {}),
  ].join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

export interface LeaseHistoryServiceDeps {
  readonly db: DbExecutor;
}

export class LeaseHistoryError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'LeaseHistoryError';
  }
}

export class LeaseHistoryService {
  private readonly db: DbExecutor;

  constructor(deps: LeaseHistoryServiceDeps) {
    this.db = deps.db;
  }

  async appendStep(
    input: AppendLeaseHistoryStepInput,
  ): Promise<LeaseHistoryStep> {
    if (!LEASE_HISTORY_ACTIONS.includes(input.action)) {
      throw new LeaseHistoryError(
        'INVALID_ACTION',
        `action=${String(input.action)} not in allowed list`,
      );
    }
    if (!LEASE_HISTORY_ACTOR_ROLES.includes(input.actorRole)) {
      throw new LeaseHistoryError(
        'INVALID_ACTOR_ROLE',
        `actorRole=${String(input.actorRole)} not in allowed list`,
      );
    }

    // Find the next step_index + previous hash atomically by reading
    // the latest row for the lease. The unique (tenant, lease, step)
    // constraint will surface a concurrent-writer conflict as a DB
    // error; the caller retries idempotently.
    const latest = rowsOf(
      await this.db.execute(sql`
        SELECT step_index, audit_hash
          FROM lease_history
         WHERE tenant_id = ${input.tenantId}::uuid
           AND lease_id  = ${input.leaseId}::uuid
         ORDER BY step_index DESC
         LIMIT 1
      `),
    )[0];

    const stepIndex = latest ? Number(latest.step_index) + 1 : 0;
    const prevAuditHash = latest ? String(latest.audit_hash) : GENESIS_HASH;

    const happenedAt = input.happenedAt ?? new Date().toISOString();
    const photoCid = input.photoCid ?? null;
    const locationLat = input.locationLat ?? null;
    const locationLon = input.locationLon ?? null;
    const amount = input.amount ?? null;
    const currencyCode = input.currencyCode ?? null;
    const provenance = input.provenance ?? {};

    const auditHash = computeStepAuditHash({
      leaseId: input.leaseId,
      stepIndex,
      action: input.action,
      actorId: input.actorId,
      actorRole: input.actorRole,
      happenedAt,
      photoCid,
      locationLat,
      locationLon,
      amount,
      currencyCode,
      prevAuditHash,
      provenance,
    });

    const id = randomUUID();
    await this.db.execute(sql`
      INSERT INTO lease_history (
        id, tenant_id, lease_id, step_index, action,
        actor_id, actor_role, happened_at, photo_cid,
        location_lat, location_lon, amount, currency_code,
        audit_hash, prev_audit_hash, provenance
      ) VALUES (
        ${id}::uuid,
        ${input.tenantId}::uuid,
        ${input.leaseId}::uuid,
        ${stepIndex},
        ${input.action},
        ${input.actorId},
        ${input.actorRole},
        ${happenedAt}::timestamptz,
        ${photoCid},
        ${locationLat},
        ${locationLon},
        ${amount},
        ${currencyCode},
        ${auditHash},
        ${prevAuditHash},
        ${JSON.stringify(provenance)}::jsonb
      )
    `);

    moduleLogger.info('lease_history_step_appended', {
      tenantId: input.tenantId,
      leaseId: input.leaseId,
      stepIndex,
      action: input.action,
      auditHash,
    });

    return {
      id,
      tenantId: input.tenantId,
      leaseId: input.leaseId,
      stepIndex,
      action: input.action,
      actorId: input.actorId,
      actorRole: input.actorRole,
      happenedAt,
      photoCid,
      locationLat,
      locationLon,
      amount,
      currencyCode,
      auditHash,
      prevAuditHash,
      provenance,
    };
  }

  async showTrace(input: ShowLeaseTraceInput): Promise<ShowLeaseTraceResult> {
    const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
    const rows = rowsOf(
      await this.db.execute(sql`
        SELECT id::text AS id,
               tenant_id::text AS tenant_id,
               lease_id::text  AS lease_id,
               step_index,
               action,
               actor_id,
               actor_role,
               happened_at,
               photo_cid,
               location_lat,
               location_lon,
               amount::text AS amount,
               currency_code,
               audit_hash,
               prev_audit_hash,
               provenance
          FROM lease_history
         WHERE tenant_id = ${input.tenantId}::uuid
           AND lease_id  = ${input.leaseId}::uuid
         ORDER BY step_index ASC
         LIMIT ${limit}
      `),
    );

    const steps: LeaseHistoryStep[] = rows.map((r) => ({
      id: String(r.id),
      tenantId: String(r.tenant_id),
      leaseId: String(r.lease_id),
      stepIndex: Number(r.step_index ?? 0),
      action: String(r.action) as LeaseHistoryAction,
      actorId: String(r.actor_id),
      actorRole: String(r.actor_role) as LeaseHistoryActorRole,
      happenedAt: String(r.happened_at ?? ''),
      photoCid: (r.photo_cid as string | null) ?? null,
      locationLat: r.location_lat == null ? null : Number(r.location_lat),
      locationLon: r.location_lon == null ? null : Number(r.location_lon),
      amount: r.amount == null ? null : Number(r.amount),
      currencyCode: (r.currency_code as string | null) ?? null,
      auditHash: String(r.audit_hash ?? ''),
      prevAuditHash: String(r.prev_audit_hash ?? ''),
      provenance:
        (r.provenance as Record<string, unknown> | null) ?? {},
    }));

    let brokenAt: number | null = null;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;
      const expectedPrev = i === 0 ? GENESIS_HASH : steps[i - 1]?.auditHash ?? '';
      if (step.prevAuditHash !== expectedPrev) {
        brokenAt = i;
        break;
      }
      const recomputed = computeStepAuditHash(step);
      if (recomputed !== step.auditHash) {
        brokenAt = i;
        break;
      }
    }

    const latestHash =
      steps.length > 0 ? steps[steps.length - 1]?.auditHash ?? GENESIS_HASH : GENESIS_HASH;
    return {
      leaseId: input.leaseId,
      steps,
      verification: { ok: brokenAt === null, brokenAt },
      latestHash,
    };
  }
}
