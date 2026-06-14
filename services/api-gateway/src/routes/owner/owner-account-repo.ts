/**
 * Owner-account repository — real, tenant-scoped Postgres for the owner-portal
 * Settings page + Skills controls.
 *
 * Backs services/api-gateway/src/routes/owner/owner-account.hono.ts. Every
 * method takes the per-request, tx-bound drizzle handle the router pulls from
 * `c.get('db')` (set by `databaseMiddleware`, which binds
 * `app.current_tenant_id` so the FORCE-RLS policies on owner_settings /
 * co_owner_invites / owner_skills fire). We additionally pass tenant_id (and,
 * where relevant, user_id) explicitly in every statement — belt-and-braces on
 * top of RLS, and the user_id predicate is the per-user anti-IDOR ownership key
 * the RLS tenant predicate alone does not provide.
 *
 * Tables:
 *   - owner_settings    (migration 0334) — per-(tenant,user) display + notif prefs
 *   - currency_preferences (existing)     — canonical FX-resolution chain mirror
 *   - co_owner_invites  (migration 0335) — pending team invitations
 *   - notification_dispatch_log (existing) — durable at-least-once invite emails
 *   - owner_skills      (migration 0162)  — owner-installable skills registry
 *
 * No money columns are touched here. No console.log — the router owns logging
 * via the Pino logger.
 */

import { sql } from 'drizzle-orm';
import { randomUUID, randomBytes } from 'node:crypto';

/**
 * Minimal drizzle handle this repo needs: a single `execute(sql)` method. The
 * router passes the tx-bound `c.get('db')`. Typed loosely to avoid the
 * `@bossnyumba/database` barrel TS2709 namespace-vs-type drift other
 * composition files document.
 */
export interface RepoDb {
  execute(query: unknown): Promise<unknown>;
}

/**
 * Normalise a drizzle `execute()` result to a row array. postgres-js returns
 * the rows array directly; node-postgres returns `{ rows }`. Mirrors the
 * established `rowsOf` idiom across the composition layer.
 */
function rowsOf(result: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result as ReadonlyArray<Record<string, unknown>>;
  }
  const wrapped = result as { rows?: ReadonlyArray<Record<string, unknown>> };
  return wrapped?.rows ?? [];
}

// ───────────────────────────────────────────────────────────────────────────
// owner_settings (migration 0334) — display + notification preferences
// ───────────────────────────────────────────────────────────────────────────

export interface OwnerSettings {
  readonly language: 'en' | 'sw';
  readonly currency: string;
  readonly timezone: string;
  readonly dateFormat: string;
  readonly notificationPrefs: Record<string, boolean>;
  readonly updatedAt: string | null;
}

/** Route-layer defaults when the owner has not saved settings yet. */
export const DEFAULT_OWNER_SETTINGS: OwnerSettings = {
  language: 'en',
  currency: 'USD',
  timezone: 'Africa/Dar_es_Salaam',
  dateFormat: 'DD/MM/YYYY',
  notificationPrefs: {},
  updatedAt: null,
};

function rowToOwnerSettings(row: Record<string, unknown>): OwnerSettings {
  const rawPrefs = row.notification_prefs;
  let prefs: Record<string, boolean> = {};
  if (rawPrefs && typeof rawPrefs === 'object') {
    prefs = rawPrefs as Record<string, boolean>;
  } else if (typeof rawPrefs === 'string') {
    try {
      prefs = JSON.parse(rawPrefs) as Record<string, boolean>;
    } catch {
      prefs = {};
    }
  }
  const lang = row.language === 'sw' ? 'sw' : 'en';
  return {
    language: lang,
    currency: String(row.currency ?? DEFAULT_OWNER_SETTINGS.currency),
    timezone: String(row.timezone ?? DEFAULT_OWNER_SETTINGS.timezone),
    dateFormat: String(row.date_format ?? DEFAULT_OWNER_SETTINGS.dateFormat),
    notificationPrefs: prefs,
    updatedAt: (row.updated_at as string | null) ?? null,
  };
}

/**
 * Resolve the caller's own settings row. Returns the route defaults (not null)
 * when no row exists yet — the FE never has to special-case "first visit".
 */
export async function getOwnerSettings(
  db: RepoDb,
  tenantId: string,
  userId: string,
): Promise<OwnerSettings> {
  const result = await db.execute(sql`
    SELECT language, currency, timezone, date_format, notification_prefs, updated_at
      FROM owner_settings
     WHERE tenant_id = ${tenantId}
       AND user_id   = ${userId}
     LIMIT 1
  `);
  const row = rowsOf(result)[0];
  return row ? rowToOwnerSettings(row) : DEFAULT_OWNER_SETTINGS;
}

export interface UpsertOwnerSettingsInput {
  readonly language: 'en' | 'sw';
  readonly currency: string;
  readonly timezone: string;
  readonly dateFormat: string;
  readonly notificationPrefs: Record<string, boolean>;
}

/**
 * Upsert the caller's settings row AND mirror the chosen currency into the
 * canonical `currency_preferences` table (scope_kind='user') so the FX
 * resolver chain (user → tenant → platform-default) keeps resolving. Currency
 * is uppercased; never DB-pinned TZS.
 */
export async function upsertOwnerSettings(
  db: RepoDb,
  tenantId: string,
  userId: string,
  input: UpsertOwnerSettingsInput,
): Promise<OwnerSettings> {
  const currency = input.currency.toUpperCase();
  const prefsJson = JSON.stringify(input.notificationPrefs ?? {});

  const result = await db.execute(sql`
    INSERT INTO owner_settings (
      id, tenant_id, user_id, language, currency, timezone, date_format,
      notification_prefs, created_at, updated_at
    ) VALUES (
      ${randomUUID()}, ${tenantId}, ${userId}, ${input.language}, ${currency},
      ${input.timezone}, ${input.dateFormat}, ${prefsJson}::jsonb, NOW(), NOW()
    )
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET
      language           = EXCLUDED.language,
      currency           = EXCLUDED.currency,
      timezone           = EXCLUDED.timezone,
      date_format        = EXCLUDED.date_format,
      notification_prefs = EXCLUDED.notification_prefs,
      updated_at         = NOW()
    RETURNING language, currency, timezone, date_format, notification_prefs, updated_at
  `);

  // Mirror the currency choice into the canonical FX-resolution chain. The
  // currency_preferences PK is (scope_kind, scope_id) — upsert the user tier.
  await db.execute(sql`
    INSERT INTO currency_preferences (scope_kind, scope_id, currency, source, updated_at)
    VALUES ('user', ${userId}, ${currency}, 'self-selected', NOW())
    ON CONFLICT (scope_kind, scope_id) DO UPDATE SET
      currency   = EXCLUDED.currency,
      source     = EXCLUDED.source,
      updated_at = NOW()
  `);

  const row = rowsOf(result)[0];
  return row ? rowToOwnerSettings(row) : { ...DEFAULT_OWNER_SETTINGS, ...input, currency, updatedAt: new Date().toISOString() };
}

// ───────────────────────────────────────────────────────────────────────────
// co_owner_invites (migration 0335) + accepted members (users)
// ───────────────────────────────────────────────────────────────────────────

export interface CoOwnerMember {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone?: string | null;
  readonly role: string;
  readonly status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  readonly invitedAt?: string | null;
  readonly lastLogin?: string | null;
  readonly properties: ReadonlyArray<string>;
}

function inviteRowToMember(row: Record<string, unknown>): CoOwnerMember {
  const rawProps = row.property_access;
  let properties: string[] = [];
  if (Array.isArray(rawProps)) {
    properties = rawProps.map((p) => String(p));
  } else if (typeof rawProps === 'string') {
    try {
      const parsed = JSON.parse(rawProps);
      if (Array.isArray(parsed)) properties = parsed.map((p) => String(p));
    } catch {
      properties = [];
    }
  }
  return {
    id: String(row.id),
    email: String(row.email ?? ''),
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    role: String(row.role ?? 'VIEWER'),
    status: 'PENDING',
    invitedAt: (row.created_at as string | null) ?? null,
    properties,
  };
}

/** List the tenant's pending (non-revoked, non-accepted) invitations. */
export async function listPendingInvites(
  db: RepoDb,
  tenantId: string,
): Promise<ReadonlyArray<CoOwnerMember>> {
  const result = await db.execute(sql`
    SELECT id, email, first_name, last_name, role, property_access, created_at
      FROM co_owner_invites
     WHERE tenant_id = ${tenantId}
       AND status = 'pending'
       AND revoked_at IS NULL
     ORDER BY created_at DESC
     LIMIT 200
  `);
  return rowsOf(result).map(inviteRowToMember);
}

export interface CreateInviteInput {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: 'CO_OWNER' | 'VIEWER';
  readonly properties: ReadonlyArray<string>;
}

export interface InviteRecord {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: string;
  readonly token: string;
  readonly properties: ReadonlyArray<string>;
}

/** Generate a url-safe single-use accept token (32 bytes of entropy). */
function newInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Insert a pending invite. Returns the row (incl. token) for the email enqueue. */
export async function createInvite(
  db: RepoDb,
  tenantId: string,
  invitedBy: string,
  input: CreateInviteInput,
): Promise<InviteRecord> {
  const id = randomUUID();
  const token = newInviteToken();
  const propsJson = JSON.stringify(input.properties ?? []);
  await db.execute(sql`
    INSERT INTO co_owner_invites (
      id, tenant_id, email, first_name, last_name, role, property_access,
      token, invited_by, status, resend_count, created_at, updated_at
    ) VALUES (
      ${id}, ${tenantId}, ${input.email}, ${input.firstName}, ${input.lastName},
      ${input.role}, ${propsJson}::jsonb, ${token}, ${invitedBy}, 'pending', 0,
      NOW(), NOW()
    )
  `);
  return {
    id,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    token,
    properties: input.properties ?? [],
  };
}

/**
 * Rotate the token + bump resend_count + extend expiry for an existing pending
 * invite. Returns the refreshed record (for a fresh email), or null when no
 * matching pending invite exists (uniform-404 anti-IDOR at the route layer).
 */
export async function rotateInviteForResend(
  db: RepoDb,
  tenantId: string,
  inviteId: string,
): Promise<InviteRecord | null> {
  const token = newInviteToken();
  const result = await db.execute(sql`
    UPDATE co_owner_invites
       SET token        = ${token},
           resend_count = resend_count + 1,
           expires_at   = NOW() + interval '14 days',
           updated_at   = NOW()
     WHERE id = ${inviteId}
       AND tenant_id = ${tenantId}
       AND status = 'pending'
       AND revoked_at IS NULL
    RETURNING id, email, first_name, last_name, role, property_access, token
  `);
  const row = rowsOf(result)[0];
  if (!row) return null;
  const rawProps = row.property_access;
  const properties = Array.isArray(rawProps)
    ? rawProps.map((p) => String(p))
    : [];
  return {
    id: String(row.id),
    email: String(row.email ?? ''),
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    role: String(row.role ?? 'VIEWER'),
    token: String(row.token),
    properties,
  };
}

/**
 * Soft-revoke a pending invite. Returns true when a row was revoked, false
 * when no matching pending invite exists (route returns uniform-404).
 */
export async function revokeInvite(
  db: RepoDb,
  tenantId: string,
  inviteId: string,
): Promise<boolean> {
  const result = await db.execute(sql`
    UPDATE co_owner_invites
       SET status     = 'revoked',
           revoked_at = NOW(),
           updated_at = NOW()
     WHERE id = ${inviteId}
       AND tenant_id = ${tenantId}
       AND status = 'pending'
       AND revoked_at IS NULL
    RETURNING id
  `);
  return rowsOf(result).length > 0;
}

// ───────────────────────────────────────────────────────────────────────────
// notification_dispatch_log (existing) — durable at-least-once invite emails
// ───────────────────────────────────────────────────────────────────────────

/**
 * Enqueue a REAL invite email via the notifications engine. The dispatcher
 * worker claims `pending` rows from notification_dispatch_log
 * (WHERE delivery_status='pending' ... FOR UPDATE SKIP LOCKED) and ships them
 * through the configured provider — this is NOT a fake/no-op. Idempotent on
 * (tenant_id, idempotency_key) so a retried resend collapses into the same row.
 */
export async function enqueueInviteEmail(
  db: RepoDb,
  params: {
    readonly tenantId: string;
    readonly invitedBy: string;
    readonly email: string;
    readonly firstName: string;
    readonly token: string;
    readonly role: string;
    readonly locale: string;
    readonly idempotencyKey: string;
    readonly correlationId: string;
  },
): Promise<void> {
  await db.execute(sql`
    INSERT INTO notification_dispatch_log (
      id, tenant_id, user_id, channel, recipient_address, template_key, locale,
      payload, correlation_id, idempotency_key, attempt_count, delivery_status,
      created_at, updated_at
    ) VALUES (
      ${randomUUID()}, ${params.tenantId}, ${params.invitedBy}, 'email',
      ${params.email}, 'co_owner_invite', ${params.locale},
      ${JSON.stringify({
        firstName: params.firstName,
        role: params.role,
        acceptToken: params.token,
      })}::jsonb,
      ${params.correlationId}, ${params.idempotencyKey}, 0, 'pending', NOW(), NOW()
    )
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
  `);
}

// ───────────────────────────────────────────────────────────────────────────
// owner_skills (migration 0162) — owner-installable skills registry
// ───────────────────────────────────────────────────────────────────────────

export interface SkillSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly author: string;
  readonly authorIsMd: boolean;
  readonly category: string;
  readonly triggerKind: 'cron' | 'event' | 'manual';
  readonly installed: boolean;
  readonly enabled: boolean;
  readonly runCount: number;
  readonly lastRunAt: string | null;
}

const VALID_TRIGGER_KINDS = new Set(['cron', 'event', 'manual']);
const VALID_CATEGORIES = new Set([
  'arrears',
  'lease',
  'maintenance',
  'comms',
  'compliance',
  'reporting',
]);

/**
 * Map an owner_skills row to the FE SkillSummary shape. trigger_config may carry
 * a `category` hint; we fall back to 'reporting' (a valid FE category) when the
 * stored value is not in the known set so the card always renders.
 */
function rowToSkillSummary(row: Record<string, unknown>): SkillSummary {
  const triggerKindRaw = String(row.trigger_kind ?? 'manual');
  const triggerKind = (VALID_TRIGGER_KINDS.has(triggerKindRaw)
    ? triggerKindRaw
    : 'manual') as 'cron' | 'event' | 'manual';

  let category = 'reporting';
  const cfg = row.trigger_config;
  if (cfg && typeof cfg === 'object' && 'category' in cfg) {
    const c = String((cfg as Record<string, unknown>).category ?? '');
    if (VALID_CATEGORIES.has(c)) category = c;
  }

  const authorIsMd = row.author_tenant_id === null || row.author_tenant_id === undefined;
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    description: String(row.description ?? ''),
    author: authorIsMd ? 'Mr. Mwikila' : 'Community',
    authorIsMd,
    category,
    triggerKind,
    // A row in owner_skills for THIS tenant IS an install.
    installed: true,
    enabled: Boolean(row.enabled),
    runCount: Number(row.run_count ?? 0),
    lastRunAt: (row.last_run_at as string | null) ?? null,
  };
}

/** List the tenant's installed skills (owner_skills rows for this tenant). */
export async function listSkills(
  db: RepoDb,
  tenantId: string,
): Promise<ReadonlyArray<SkillSummary>> {
  const result = await db.execute(sql`
    SELECT id, author_tenant_id, name, slug, description, trigger_kind,
           trigger_config, enabled, run_count, last_run_at
      FROM owner_skills
     WHERE installed_by_tenant_id = ${tenantId}
     ORDER BY installed_at DESC
     LIMIT 500
  `);
  return rowsOf(result).map(rowToSkillSummary);
}

/** Fetch one installed skill by id (tenant-scoped). Null when not found. */
export async function getSkill(
  db: RepoDb,
  tenantId: string,
  skillId: string,
): Promise<SkillSummary | null> {
  const result = await db.execute(sql`
    SELECT id, author_tenant_id, name, slug, description, trigger_kind,
           trigger_config, enabled, run_count, last_run_at
      FROM owner_skills
     WHERE id = ${skillId}
       AND installed_by_tenant_id = ${tenantId}
     LIMIT 1
  `);
  const row = rowsOf(result)[0];
  return row ? rowToSkillSummary(row) : null;
}

/**
 * Install (enable) an existing owner_skills row for this tenant. Returns the
 * updated skill, or null when no matching row exists. We do NOT fabricate a
 * catalog row: a skill must already exist in owner_skills (seeded MD-authored
 * or community-shared) to be installable — otherwise the route returns an
 * honest typed not_available.
 */
export async function setSkillInstalled(
  db: RepoDb,
  tenantId: string,
  skillId: string,
): Promise<SkillSummary | null> {
  const result = await db.execute(sql`
    UPDATE owner_skills
       SET enabled = true
     WHERE id = ${skillId}
       AND installed_by_tenant_id = ${tenantId}
    RETURNING id, author_tenant_id, name, slug, description, trigger_kind,
              trigger_config, enabled, run_count, last_run_at
  `);
  const row = rowsOf(result)[0];
  return row ? rowToSkillSummary(row) : null;
}

/** Toggle a skill's enabled flag. Null when not found. */
export async function setSkillEnabled(
  db: RepoDb,
  tenantId: string,
  skillId: string,
  enabled: boolean,
): Promise<SkillSummary | null> {
  const result = await db.execute(sql`
    UPDATE owner_skills
       SET enabled = ${enabled}
     WHERE id = ${skillId}
       AND installed_by_tenant_id = ${tenantId}
    RETURNING id, author_tenant_id, name, slug, description, trigger_kind,
              trigger_config, enabled, run_count, last_run_at
  `);
  const row = rowsOf(result)[0];
  return row ? rowToSkillSummary(row) : null;
}

/**
 * Record a manual skill run: bump run_count + stamp last_run_at. The actual
 * skill EXECUTION is dispatched by the brain (the FE opens Jarvis with the
 * run prompt); this persists the run accounting so the card's "N runs · last
 * …" reflects reality. Null when the skill is not installed/enabled.
 */
export async function recordSkillRun(
  db: RepoDb,
  tenantId: string,
  skillId: string,
): Promise<SkillSummary | null> {
  const result = await db.execute(sql`
    UPDATE owner_skills
       SET run_count   = run_count + 1,
           last_run_at = NOW()
     WHERE id = ${skillId}
       AND installed_by_tenant_id = ${tenantId}
       AND enabled = true
    RETURNING id, author_tenant_id, name, slug, description, trigger_kind,
              trigger_config, enabled, run_count, last_run_at
  `);
  const row = rowsOf(result)[0];
  return row ? rowToSkillSummary(row) : null;
}
