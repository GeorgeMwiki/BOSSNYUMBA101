/**
 * Co-owner invite acceptance repository — resolves + consumes the opaque
 * single-use accept token created by the owner-portal invite flow
 * (POST /owner/account/co-owners/invite → co_owner_invites, migration 0335).
 *
 * Backs the two public auth routes the owner-portal InvitePage drives:
 *   - GET  /auth/invite/:token   (anonymous preview)
 *   - POST /auth/accept-invite   (anonymous consume → provision the invitee)
 *
 * RLS POSTURE (read before editing)
 * ─────────────────────────────────
 * Token resolution is INHERENTLY cross-tenant: the caller is an anonymous
 * invitee, so no `app.current_tenant_id` GUC is bound and we do not yet know
 * which tenant the token belongs to (the token itself carries the binding via
 * the UNIQUE index `uniq_co_owner_invites_token`). Every function here is
 * therefore designed to run INSIDE `withServiceRoleContext(db, …)` — the 0335
 * `co_owner_invites_service_role_bypass` policy lets these reads/writes through
 * while the tenant-isolation policy would otherwise zero the rows. The route
 * layer owns the `withServiceRoleContext` wrap; these helpers take the bound
 * `tx` handle and additionally scope every write by the resolved `tenant_id`
 * (belt-and-braces — the token already pins the tenant).
 *
 * No money columns are touched here. No console.log — the router owns logging.
 */

import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

/**
 * Minimal drizzle handle this repo needs: a single `execute(sql)` method —
 * the `tx` handed back by `withServiceRoleContext`. Typed loosely to avoid the
 * `@bossnyumba/database` barrel TS2709 namespace-vs-type drift documented in
 * the composition layer.
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

/** Why a token failed to resolve into an acceptable invite. */
export type InviteRejection = 'not_found' | 'expired' | 'revoked' | 'accepted';

/** The raw invite row + resolved org/inviter context, for the FE preview. */
export interface ResolvedInvite {
  readonly id: string;
  readonly tenantId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: string;
  readonly properties: ReadonlyArray<string>;
  readonly status: string;
  readonly expiresAt: string | null;
  readonly acceptedAt: string | null;
  readonly revokedAt: string | null;
  /** Inviting user id (audit) — stamped onto the provisioned invitee. */
  readonly invitedBy: string | null;
  readonly organizationName: string;
  readonly inviterName: string;
}

function parseProps(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((p) => String(p));
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((p) => String(p));
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Resolve an invite by its opaque token, joining the owning tenant (org name)
 * and the inviting user (inviter display name) for the FE preview. Returns
 * `null` when no row carries the token at all (uniform not-found). The caller
 * inspects `status`/`expiresAt`/`revoked` to classify expired/revoked/accepted.
 *
 * MUST run inside `withServiceRoleContext` — see the file header.
 */
export async function resolveInviteByToken(
  db: RepoDb,
  token: string,
): Promise<ResolvedInvite | null> {
  const result = await db.execute(sql`
    SELECT
      ci.id,
      ci.tenant_id,
      ci.email,
      ci.first_name,
      ci.last_name,
      ci.role,
      ci.property_access,
      ci.status,
      ci.expires_at,
      ci.accepted_at,
      ci.revoked_at,
      ci.invited_by,
      t.name AS organization_name,
      inv.first_name AS inviter_first_name,
      inv.last_name  AS inviter_last_name
    FROM co_owner_invites ci
    LEFT JOIN tenants t ON t.id = ci.tenant_id
    LEFT JOIN users   inv ON inv.id = ci.invited_by
    WHERE ci.token = ${token}
    LIMIT 1
  `);
  const row = rowsOf(result)[0];
  if (!row) return null;

  const inviterFirst = String(row.inviter_first_name ?? '').trim();
  const inviterLast = String(row.inviter_last_name ?? '').trim();
  const inviterName =
    `${inviterFirst} ${inviterLast}`.trim() || 'A BossNyumba owner';

  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    email: String(row.email ?? ''),
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    role: String(row.role ?? 'VIEWER'),
    properties: parseProps(row.property_access),
    status: String(row.status ?? 'pending'),
    expiresAt: (row.expires_at as string | null) ?? null,
    acceptedAt: (row.accepted_at as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    invitedBy: (row.invited_by as string | null) ?? null,
    organizationName: String(row.organization_name ?? 'Your organization'),
    inviterName,
  };
}

/**
 * Classify an invite as acceptable or one of the rejection reasons. A `pending`
 * invite that is non-revoked and not past `expires_at` is acceptable (returns
 * `null`). Order: revoked → accepted → expired (expired is checked last so an
 * already-revoked/accepted invite reports its terminal state rather than a
 * misleading "expired").
 */
export function classifyInvite(
  invite: ResolvedInvite,
  nowMs: number = Date.now(),
): InviteRejection | null {
  if (invite.revokedAt || invite.status === 'revoked') return 'revoked';
  if (invite.status === 'accepted') return 'accepted';
  if (invite.status !== 'pending') return 'not_found';
  if (invite.expiresAt) {
    const exp = new Date(invite.expiresAt).getTime();
    if (Number.isFinite(exp) && exp <= nowMs) return 'expired';
  }
  return null;
}

/**
 * Find an existing (non-deleted) user in a tenant by email (case-insensitive).
 * Returns the user id when present — the anti-double-provision key for the
 * idempotent accept path.
 */
async function findUserByEmail(
  db: RepoDb,
  tenantId: string,
  email: string,
): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT id
      FROM users
     WHERE tenant_id = ${tenantId}
       AND LOWER(email) = LOWER(${email})
       AND deleted_at IS NULL
     LIMIT 1
  `);
  const row = rowsOf(result)[0];
  return row ? String(row.id) : null;
}

/**
 * Upsert the tenant-scoped role row matching the invite's grant
 * (CO_OWNER → 'co_owner', VIEWER → 'viewer') and return its id. Idempotent via
 * the `(tenant_id, name)` unique index — a re-accept reuses the same role row.
 * Permissions are the minimal co-owner-grantable set; never '*'.
 */
async function ensureRole(
  db: RepoDb,
  tenantId: string,
  inviteRole: string,
): Promise<string> {
  const name = inviteRole === 'CO_OWNER' ? 'co_owner' : 'viewer';
  const displayName = inviteRole === 'CO_OWNER' ? 'Co-owner' : 'Viewer';
  // VIEWER: read-only across the portal surfaces. CO_OWNER: read + the
  // operational writes a co-owner needs, but NEVER owner/admin escalation
  // (the invite surface itself is constrained to these two roles by the 0335
  // CHECK constraint + requireRole on the issue path).
  const permissions =
    inviteRole === 'CO_OWNER'
      ? [
          'property:read',
          'property:update',
          'lease:read',
          'lease:update',
          'invoice:read',
          'payment:read',
          'maintenance:read',
          'maintenance:approve',
        ]
      : [
          'property:read',
          'lease:read',
          'invoice:read',
          'payment:read',
          'maintenance:read',
        ];
  const priority = inviteRole === 'CO_OWNER' ? 40 : 10;

  const result = await db.execute(sql`
    INSERT INTO roles (
      id, tenant_id, name, display_name, description, permissions,
      is_system, is_active, priority, created_at, updated_at
    ) VALUES (
      ${randomUUID()}, ${tenantId}, ${name}, ${displayName},
      ${'Granted via co-owner invitation.'}, ${JSON.stringify(permissions)}::jsonb,
      false, true, ${priority}, NOW(), NOW()
    )
    ON CONFLICT (tenant_id, name) DO UPDATE SET updated_at = NOW()
    RETURNING id
  `);
  const row = rowsOf(result)[0];
  if (row) return String(row.id);

  // Defensive: some drizzle/postgres combos do not surface RETURNING on a
  // DO-UPDATE no-op consistently — re-select to be safe.
  const reselect = await db.execute(sql`
    SELECT id FROM roles
     WHERE tenant_id = ${tenantId} AND name = ${name}
     LIMIT 1
  `);
  const rrow = rowsOf(reselect)[0];
  if (!rrow) {
    throw new Error('Failed to resolve invite role after upsert');
  }
  return String(rrow.id);
}

export interface AcceptInviteProfile {
  readonly firstName: string;
  readonly lastName: string;
  readonly passwordHash: string;
}

export interface AcceptInviteResult {
  readonly userId: string;
  readonly tenantId: string;
  readonly email: string;
  readonly role: string;
  readonly organizationName: string;
  /** True when this call newly provisioned the user (vs. an idempotent replay). */
  readonly created: boolean;
}

/**
 * Consume a (already-validated, acceptable) invite: provision the invitee user
 * (or reuse the existing user on idempotent replay), link the tenant-scoped
 * role, and flip the invite to `accepted` + stamp `accepted_at`.
 *
 * Idempotent: re-running with the same token (or after a partial first run)
 * neither duplicates the user nor the role link, and re-flips the invite
 * harmlessly. The caller resolves + classifies the invite first; this function
 * trusts that the invite is acceptable OR already-accepted (the accepted-replay
 * path is handled here so a double-submit from the FE still succeeds).
 *
 * MUST run inside `withServiceRoleContext` — see the file header. The whole
 * sequence runs in that single transaction, so a mid-sequence failure rolls
 * back cleanly (no orphaned user without a role, no flipped invite without a
 * user).
 */
export async function acceptInvite(
  db: RepoDb,
  invite: ResolvedInvite,
  profile: AcceptInviteProfile,
): Promise<AcceptInviteResult> {
  const tenantId = invite.tenantId;
  const email = invite.email;

  // 1. Provision or reuse the user (anti-double-provision on (tenant,email)).
  let userId = await findUserByEmail(db, tenantId, email);
  let created = false;
  if (!userId) {
    userId = randomUUID();
    created = true;
    await db.execute(sql`
      INSERT INTO users (
        id, tenant_id, email, password_hash, first_name, last_name,
        status, is_owner, invited_by, activated_at, created_at, updated_at
      ) VALUES (
        ${userId}, ${tenantId}, ${email}, ${profile.passwordHash},
        ${profile.firstName}, ${profile.lastName}, 'active', false,
        ${invite.invitedBy}, NOW(), NOW(), NOW()
      )
      ON CONFLICT (tenant_id, email) DO NOTHING
    `);
    // If a concurrent accept won the insert race, re-resolve the winner's id so
    // the role link below targets the real row rather than a rolled-back id.
    const settled = await findUserByEmail(db, tenantId, email);
    if (settled) {
      created = settled === userId;
      userId = settled;
    }
  }

  // 2. Ensure the tenant role exists + link the user to it (idempotent).
  const roleId = await ensureRole(db, tenantId, invite.role);
  await db.execute(sql`
    INSERT INTO user_roles (id, user_id, role_id, tenant_id, assigned_at, assigned_by)
    VALUES (${randomUUID()}, ${userId}, ${roleId}, ${tenantId}, NOW(), 'co_owner_invite')
    ON CONFLICT (user_id, role_id) DO NOTHING
  `);

  // 3. Flip the invite to accepted (idempotent — only pending → accepted).
  await db.execute(sql`
    UPDATE co_owner_invites
       SET status      = 'accepted',
           accepted_at = COALESCE(accepted_at, NOW()),
           updated_at  = NOW()
     WHERE id = ${invite.id}
       AND tenant_id = ${tenantId}
       AND status = 'pending'
  `);

  return {
    userId,
    tenantId,
    email,
    role: invite.role,
    organizationName: invite.organizationName,
    created,
  };
}
