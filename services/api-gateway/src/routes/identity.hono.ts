/**
 * Identity router — cross-org tenant identity, invites, memberships, phone OTP.
 *
 * Backs `@bossnyumba/identity` (Conflict 2: Universal Tenant Identity +
 * Multi-Org). All endpoints are auth-gated. Tenant scope is derived SOLELY
 * from the verified JWT (`auth.tenantId` / `auth.userId`); a client-supplied
 * tenantId is NEVER trusted.
 *
 * SECURITY — tenant_identities is a CROSS-ORG table (unique phone index, no
 * RLS by design), and the underlying services act on rows by primary key. So
 * tenant isolation for invite/membership mutations is enforced HERE, at the
 * route layer:
 *
 *   - Org-scoped writes (invite generate/list/revoke) resolve the caller's
 *     organization from their own `users` row (tenantId + userId) and verify
 *     any referenced code/membership belongs to the caller's PLATFORM TENANT
 *     before mutating it.
 *   - Membership leave/block verify `membership.platformTenantId === tenantId`.
 *   - /merge verifies BOTH identities are visible within the caller's tenant
 *     (≥1 membership in `auth.tenantId`) before merging, and the merge itself
 *     is tenant-scoped end-to-end so only in-tenant rows are touched.
 *   - /onboard/phone/start is admin-gated and returns a uniform 202 even when
 *     throttled, so the throttle is not a cross-tenant enumeration oracle.
 *   - Admin-only operations (generate, revoke, block, merge, phone onboarding)
 *     require TENANT_ADMIN / SUPER_ADMIN.
 *
 * Routes (mounted at /api/v1/identity):
 *   POST   /invites                 generate a code           (admin)
 *   GET    /invites                 list codes for caller org
 *   POST   /invites/redeem          redeem a code for an identity
 *   POST   /invites/:code/revoke    revoke a code             (admin)
 *   GET    /memberships             list memberships for an identity
 *   POST   /memberships/:id/leave   leave a membership
 *   POST   /memberships/:id/block   block a membership        (admin)
 *   POST   /onboard/phone/start     create/upsert identity + send OTP (admin)
 *   POST   /onboard/phone/verify    verify OTP
 *   POST   /merge                   merge duplicate identities (admin, in-tenant)
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { sql } from 'drizzle-orm';

import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { getSharedPerTenantRateBudget } from '../middleware/per-tenant-rate-budget';
import { createLogger } from '../utils/logger.js';
import { isTenantAdmin } from '../types/user-role';
import type { UserRole } from '../types/user-role';
import type { IdentityServices } from '../composition/identity-wiring';
import { OtpResendThrottledError } from '@bossnyumba/identity';
import {
  asInviteCode,
  asOrgMembershipId,
  asTenantIdentityId,
  type OrganizationId,
  type RoleId,
  type TenantIdentityId,
  type UserId,
} from '@bossnyumba/domain-models';

const moduleLogger = createLogger('identity');

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const GenerateInviteSchema = z.object({
  /** Optional explicit org; when omitted we resolve the caller's own org. */
  organizationId: z.string().min(1).max(128).optional(),
  defaultRoleId: z.string().min(1).max(128),
  expiresAt: z.string().datetime().optional(),
  maxRedemptions: z.number().int().positive().max(100000).optional(),
  attachmentHints: z
    .object({
      propertyId: z.string().min(1).max(128).optional(),
      unitId: z.string().min(1).max(128).optional(),
    })
    .optional(),
});

const RedeemInviteSchema = z.object({
  code: z.string().min(3).max(64),
  tenantIdentityId: z.string().min(1).max(128),
});

const BlockMembershipSchema = z.object({
  reason: z.string().min(1).max(500),
});

const PhoneStartSchema = z.object({
  phone: z.string().min(4).max(32),
  /** ISO-3166 alpha-2; falls back to the platform default when omitted. */
  countryCode: z
    .string()
    .regex(/^[A-Za-z]{2}$/u, 'countryCode must be ISO-3166 alpha-2')
    .optional(),
});

const PhoneVerifySchema = z.object({
  tenantIdentityId: z.string().min(1).max(128),
  code: z.string().min(4).max(12),
});

const MergeSchema = z.object({
  primaryId: z.string().min(1).max(128),
  duplicateId: z.string().min(1).max(128),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface AuthSlice {
  readonly tenantId: string;
  readonly userId: string;
  readonly role: UserRole;
}

/** Pull the verified auth slice or null. */
function getAuth(c: {
  get: (k: 'auth') => { tenantId?: string; userId?: string; role?: UserRole } | undefined;
}): AuthSlice | null {
  const auth = c.get('auth');
  if (!auth?.tenantId || !auth.userId || !auth.role) return null;
  return { tenantId: auth.tenantId, userId: auth.userId, role: auth.role };
}

/** Resolve identity services from the context bag, or null in degraded mode. */
function getIdentity(c: {
  get: (k: 'services') => unknown;
}): IdentityServices | null {
  const services = (c.get('services') ?? {}) as {
    identity?: IdentityServices | null;
  };
  return services.identity ?? null;
}

interface DbExecutor {
  execute(q: unknown): Promise<unknown>;
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
 * Resolve the caller's organization id from their own `users` row, scoped by
 * the JWT tenant + user. Returns null when the user has no organization bound.
 * This is the trust anchor for org-scoped writes — the caller can only ever
 * act on the org their own (tenant-scoped) user row points at.
 */
async function resolveCallerOrgId(
  db: DbExecutor,
  tenantId: string,
  userId: string,
): Promise<string | null> {
  const rows = rowsOf(
    await db.execute(sql`
      SELECT organization_id
        FROM users
       WHERE id = ${userId}
         AND tenant_id = ${tenantId}
       LIMIT 1
    `),
  );
  const orgId = rows[0]?.organization_id;
  return typeof orgId === 'string' && orgId.length > 0 ? orgId : null;
}

/**
 * Verify a candidate organization id belongs to the caller's tenant. Used when
 * a request supplies an explicit organizationId — it must be in-tenant.
 */
async function orgBelongsToTenant(
  db: DbExecutor,
  orgId: string,
  tenantId: string,
): Promise<boolean> {
  const rows = rowsOf(
    await db.execute(sql`
      SELECT 1
        FROM organizations
       WHERE id = ${orgId}
         AND tenant_id = ${tenantId}
       LIMIT 1
    `),
  );
  return rows.length > 0;
}

const errBody = (code: string, message: string, extra?: unknown) => ({
  success: false as const,
  error: extra === undefined ? { code, message } : { code, message, issues: extra },
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createIdentityRouter(): Hono {
  const app = new Hono();

  app.use('*', authMiddleware, databaseMiddleware);
  app.use('*', getSharedPerTenantRateBudget({ surface: 'api' }).handler);

  // ── POST /invites — generate ──────────────────────────────────────────
  app.post('/invites', async (c) => {
    const auth = getAuth(c);
    if (!auth) return c.json(errBody('AUTH_REQUIRED', 'authentication required'), 401);
    if (!isTenantAdmin(auth.role)) {
      return c.json(errBody('FORBIDDEN', 'admin role required to issue invites'), 403);
    }
    const identity = getIdentity(c);
    if (!identity) return c.json(errBody('IDENTITY_NOT_CONFIGURED', 'identity service unavailable'), 503);

    const parsed = GenerateInviteSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(errBody('INVALID_PARAMS', 'invalid invite payload', parsed.error.issues), 400);
    }
    const db = c.get('db') as DbExecutor;

    // Resolve + authorize the org. An explicit org must belong to the
    // caller's tenant; otherwise default to the caller's own org.
    let orgId: string | null;
    if (parsed.data.organizationId) {
      const ok = await orgBelongsToTenant(db, parsed.data.organizationId, auth.tenantId);
      if (!ok) {
        return c.json(errBody('FORBIDDEN', 'organization is not in your tenant'), 403);
      }
      orgId = parsed.data.organizationId;
    } else {
      orgId = await resolveCallerOrgId(db, auth.tenantId, auth.userId);
    }
    if (!orgId) {
      return c.json(errBody('NO_ORGANIZATION', 'caller has no organization to issue invites for'), 422);
    }

    try {
      const record = await identity.inviteCode.generate(
        orgId as unknown as OrganizationId,
        auth.userId as unknown as UserId,
        {
          defaultRoleId: parsed.data.defaultRoleId as unknown as RoleId,
          expiresAt: parsed.data.expiresAt as never,
          maxRedemptions: parsed.data.maxRedemptions,
          attachmentHints: parsed.data.attachmentHints as never,
        },
      );
      moduleLogger.info('invite_generated', {
        tenantId: auth.tenantId,
        orgId,
        issuedBy: auth.userId,
        code: record.code,
      });
      return c.json({ success: true, data: { invite: record } }, 201);
    } catch (error) {
      moduleLogger.error('invite_generate_failed', {
        tenantId: auth.tenantId,
        orgId,
        error: (error as Error).message,
      });
      return c.json(errBody('INVITE_GENERATE_FAILED', 'could not generate invite'), 500);
    }
  });

  // ── GET /invites — list for caller org ────────────────────────────────
  app.get('/invites', async (c) => {
    const auth = getAuth(c);
    if (!auth) return c.json(errBody('AUTH_REQUIRED', 'authentication required'), 401);
    const identity = getIdentity(c);
    if (!identity) return c.json(errBody('IDENTITY_NOT_CONFIGURED', 'identity service unavailable'), 503);

    const db = c.get('db') as DbExecutor;
    const orgId = await resolveCallerOrgId(db, auth.tenantId, auth.userId);
    if (!orgId) {
      // No org → empty list (honest empty state, not an error).
      return c.json({ success: true, data: { invites: [] } });
    }
    try {
      const invites = await identity.inviteCode.listForOrg(
        orgId as unknown as OrganizationId,
      );
      return c.json({ success: true, data: { invites } });
    } catch (error) {
      moduleLogger.error('invite_list_failed', {
        tenantId: auth.tenantId,
        orgId,
        error: (error as Error).message,
      });
      return c.json(errBody('INVITE_LIST_FAILED', 'could not list invites'), 500);
    }
  });

  // ── POST /invites/redeem ──────────────────────────────────────────────
  // Redeeming creates a membership in the code's org. The code itself is the
  // capability; we additionally verify the code's platform tenant matches the
  // caller's tenant so a code cannot be redeemed cross-tenant by the operator
  // surface. (The redeemed identity is global by design.)
  app.post('/invites/redeem', async (c) => {
    const auth = getAuth(c);
    if (!auth) return c.json(errBody('AUTH_REQUIRED', 'authentication required'), 401);
    const identity = getIdentity(c);
    if (!identity) return c.json(errBody('IDENTITY_NOT_CONFIGURED', 'identity service unavailable'), 503);

    const parsed = RedeemInviteSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(errBody('INVALID_PARAMS', 'invalid redeem payload', parsed.error.issues), 400);
    }
    const code = asInviteCode(parsed.data.code);

    // Authorize: the code must exist and belong to the caller's tenant.
    const record = await identity.inviteCode.findByCode(code);
    if (!record) {
      return c.json(errBody('INVITE_NOT_FOUND', 'invite code not found'), 404);
    }
    if ((record.platformTenantId as unknown as string) !== auth.tenantId) {
      // Do not reveal that the code exists in another tenant.
      return c.json(errBody('INVITE_NOT_FOUND', 'invite code not found'), 404);
    }

    try {
      const result = await identity.inviteCode.redeem(
        code,
        asTenantIdentityId(parsed.data.tenantIdentityId),
      );
      moduleLogger.info('invite_redeemed', {
        tenantId: auth.tenantId,
        code,
        membershipId: result.membership.id,
      });
      return c.json({ success: true, data: { membership: result.membership, code: result.code } }, 201);
    } catch (error) {
      return mapRedeemError(c, error);
    }
  });

  // ── POST /invites/:code/revoke ────────────────────────────────────────
  app.post('/invites/:code/revoke', async (c) => {
    const auth = getAuth(c);
    if (!auth) return c.json(errBody('AUTH_REQUIRED', 'authentication required'), 401);
    if (!isTenantAdmin(auth.role)) {
      return c.json(errBody('FORBIDDEN', 'admin role required to revoke invites'), 403);
    }
    const identity = getIdentity(c);
    if (!identity) return c.json(errBody('IDENTITY_NOT_CONFIGURED', 'identity service unavailable'), 503);

    const code = asInviteCode(c.req.param('code'));
    const record = await identity.inviteCode.findByCode(code);
    if (!record || (record.platformTenantId as unknown as string) !== auth.tenantId) {
      return c.json(errBody('INVITE_NOT_FOUND', 'invite code not found'), 404);
    }
    try {
      const revoked = await identity.inviteCode.revoke(code);
      moduleLogger.info('invite_revoked', { tenantId: auth.tenantId, code });
      return c.json({ success: true, data: { invite: revoked } });
    } catch (error) {
      moduleLogger.error('invite_revoke_failed', {
        tenantId: auth.tenantId,
        code,
        error: (error as Error).message,
      });
      return c.json(errBody('INVITE_REVOKE_FAILED', 'could not revoke invite'), 500);
    }
  });

  // ── GET /memberships?identityId=... ───────────────────────────────────
  // Lists memberships for an identity, filtered to the caller's tenant so the
  // operator only sees rows that live in their platform tenant.
  app.get('/memberships', async (c) => {
    const auth = getAuth(c);
    if (!auth) return c.json(errBody('AUTH_REQUIRED', 'authentication required'), 401);
    const identity = getIdentity(c);
    if (!identity) return c.json(errBody('IDENTITY_NOT_CONFIGURED', 'identity service unavailable'), 503);

    const identityId = c.req.query('identityId');
    if (!identityId) {
      return c.json(errBody('INVALID_PARAMS', 'identityId query param is required'), 400);
    }
    try {
      const all = await identity.orgMembership.listForIdentity(
        asTenantIdentityId(identityId),
      );
      const scoped = all.filter(
        (m) => (m.platformTenantId as unknown as string) === auth.tenantId,
      );
      return c.json({ success: true, data: { memberships: scoped } });
    } catch (error) {
      moduleLogger.error('membership_list_failed', {
        tenantId: auth.tenantId,
        error: (error as Error).message,
      });
      return c.json(errBody('MEMBERSHIP_LIST_FAILED', 'could not list memberships'), 500);
    }
  });

  // ── POST /memberships/:id/leave ───────────────────────────────────────
  app.post('/memberships/:id/leave', async (c) => {
    const auth = getAuth(c);
    if (!auth) return c.json(errBody('AUTH_REQUIRED', 'authentication required'), 401);
    const identity = getIdentity(c);
    if (!identity) return c.json(errBody('IDENTITY_NOT_CONFIGURED', 'identity service unavailable'), 503);

    const id = asOrgMembershipId(c.req.param('id'));
    const scopeError = await assertMembershipInTenant(c, identity, id, auth.tenantId);
    if (scopeError) return scopeError;

    try {
      const updated = await identity.orgMembership.leaveMembership(id);
      moduleLogger.info('membership_left', { tenantId: auth.tenantId, membershipId: id });
      return c.json({ success: true, data: { membership: updated } });
    } catch (error) {
      moduleLogger.error('membership_leave_failed', {
        tenantId: auth.tenantId,
        membershipId: id,
        error: (error as Error).message,
      });
      return c.json(errBody('MEMBERSHIP_LEAVE_FAILED', 'could not leave membership'), 500);
    }
  });

  // ── POST /memberships/:id/block ───────────────────────────────────────
  app.post('/memberships/:id/block', async (c) => {
    const auth = getAuth(c);
    if (!auth) return c.json(errBody('AUTH_REQUIRED', 'authentication required'), 401);
    if (!isTenantAdmin(auth.role)) {
      return c.json(errBody('FORBIDDEN', 'admin role required to block members'), 403);
    }
    const identity = getIdentity(c);
    if (!identity) return c.json(errBody('IDENTITY_NOT_CONFIGURED', 'identity service unavailable'), 503);

    const parsed = BlockMembershipSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(errBody('INVALID_PARAMS', 'reason is required', parsed.error.issues), 400);
    }
    const id = asOrgMembershipId(c.req.param('id'));
    const scopeError = await assertMembershipInTenant(c, identity, id, auth.tenantId);
    if (scopeError) return scopeError;

    try {
      const updated = await identity.orgMembership.blockMembership(id, parsed.data.reason);
      moduleLogger.info('membership_blocked', { tenantId: auth.tenantId, membershipId: id });
      return c.json({ success: true, data: { membership: updated } });
    } catch (error) {
      moduleLogger.error('membership_block_failed', {
        tenantId: auth.tenantId,
        membershipId: id,
        error: (error as Error).message,
      });
      return c.json(errBody('MEMBERSHIP_BLOCK_FAILED', 'could not block membership'), 500);
    }
  });

  // ── POST /onboard/phone/start ─────────────────────────────────────────
  // Create/upsert a global identity by phone and dispatch an OTP. The
  // identity is intentionally cross-org; only the caller's tenant context is
  // used for the SMS dispatch + audit, never to scope the identity row.
  //
  // This is an OPERATOR-driven onboarding action: it both reveals whether a
  // phone is already registered (the throttle outcome) and dispatches a real
  // emergency-priority SMS. Both are abusable by an arbitrary authenticated
  // user (enumeration oracle + SMS-bomb), so the route is admin-gated. The
  // throttled path additionally returns the SAME 202 shape as a fresh send so
  // the response cannot be used as a cross-tenant phone-registration oracle.
  app.post('/onboard/phone/start', async (c) => {
    const auth = getAuth(c);
    if (!auth) return c.json(errBody('AUTH_REQUIRED', 'authentication required'), 401);
    if (!isTenantAdmin(auth.role)) {
      return c.json(errBody('FORBIDDEN', 'admin role required to start phone onboarding'), 403);
    }
    const identity = getIdentity(c);
    if (!identity) return c.json(errBody('IDENTITY_NOT_CONFIGURED', 'identity service unavailable'), 503);

    const parsed = PhoneStartSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(errBody('INVALID_PARAMS', 'invalid phone payload', parsed.error.issues), 400);
    }
    const countryCode = (parsed.data.countryCode ?? identity.defaultCountryCode).toUpperCase();

    let tenantIdentityId: TenantIdentityId;
    let normalizedPhone: string;
    try {
      const created = await identity.tenantIdentity.createOrUpsertByPhone(
        parsed.data.phone,
        countryCode,
      );
      tenantIdentityId = created.id;
      normalizedPhone = created.phoneNormalized;
    } catch (error) {
      // normalizePhoneForCountry throws on unknown country / empty phone. Log
      // the detail server-side but return a FIXED message — never reflect the
      // raw error (it can leak the submitted phone / internal detail).
      moduleLogger.warn('phone_onboard_normalize_failed', {
        tenantId: auth.tenantId,
        error: (error as Error).message,
      });
      return c.json(errBody('INVALID_PHONE', 'invalid phone or country code'), 400);
    }

    try {
      await identity.otp.send(tenantIdentityId, normalizedPhone);
      moduleLogger.info('phone_onboard_otp_sent', {
        tenantId: auth.tenantId,
        tenantIdentityId,
      });
      // Never return the code or phone. The client polls verify next.
      return c.json({ success: true, data: { tenantIdentityId } }, 202);
    } catch (error) {
      if (error instanceof OtpResendThrottledError) {
        // Throttled (cooldown / hourly cap). Silently drop the resend and
        // return the SAME 202 success shape as a fresh send. A distinct
        // 429-vs-202 outcome would leak whether the phone was recently
        // OTP'd — a cross-tenant phone-registration enumeration oracle.
        // We log server-side (no phone) for observability.
        moduleLogger.info('phone_onboard_otp_throttled', {
          tenantId: auth.tenantId,
          tenantIdentityId,
        });
        return c.json({ success: true, data: { tenantIdentityId } }, 202);
      }
      moduleLogger.error('phone_onboard_otp_failed', {
        tenantId: auth.tenantId,
        tenantIdentityId,
        error: (error as Error).message,
      });
      return c.json(errBody('OTP_SEND_FAILED', 'could not send verification code'), 502);
    }
  });

  // ── POST /onboard/phone/verify ────────────────────────────────────────
  app.post('/onboard/phone/verify', async (c) => {
    const auth = getAuth(c);
    if (!auth) return c.json(errBody('AUTH_REQUIRED', 'authentication required'), 401);
    const identity = getIdentity(c);
    if (!identity) return c.json(errBody('IDENTITY_NOT_CONFIGURED', 'identity service unavailable'), 503);

    const parsed = PhoneVerifySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(errBody('INVALID_PARAMS', 'invalid verify payload', parsed.error.issues), 400);
    }
    try {
      const result = await identity.tenantIdentity.verifyPhoneOTP(
        asTenantIdentityId(parsed.data.tenantIdentityId),
        parsed.data.code,
      );
      if (!result.verified) {
        return c.json(errBody('OTP_INVALID', 'verification failed'), 401);
      }
      moduleLogger.info('phone_onboard_verified', {
        tenantId: auth.tenantId,
        tenantIdentityId: parsed.data.tenantIdentityId,
      });
      return c.json({ success: true, data: { identity: result.identity } });
    } catch (error) {
      moduleLogger.error('phone_onboard_verify_failed', {
        tenantId: auth.tenantId,
        error: (error as Error).message,
      });
      return c.json(errBody('OTP_VERIFY_FAILED', 'could not verify code'), 500);
    }
  });

  // ── POST /merge — merge duplicate identities (admin) ──────────────────
  app.post('/merge', async (c) => {
    const auth = getAuth(c);
    if (!auth) return c.json(errBody('AUTH_REQUIRED', 'authentication required'), 401);
    if (!isTenantAdmin(auth.role)) {
      return c.json(errBody('FORBIDDEN', 'admin role required to merge identities'), 403);
    }
    const identity = getIdentity(c);
    if (!identity) return c.json(errBody('IDENTITY_NOT_CONFIGURED', 'identity service unavailable'), 503);

    const parsed = MergeSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(errBody('INVALID_PARAMS', 'invalid merge payload', parsed.error.issues), 400);
    }
    if (parsed.data.primaryId === parsed.data.duplicateId) {
      return c.json(errBody('INVALID_PARAMS', 'primaryId and duplicateId must differ'), 400);
    }

    const primaryId = asTenantIdentityId(parsed.data.primaryId);
    const duplicateId = asTenantIdentityId(parsed.data.duplicateId);

    // Ownership gate: tenant_identities is a global cross-org table with no RLS
    // and the prod role is BYPASSRLS, so a tenant-admin could otherwise merge
    // an identity that lives entirely in ANOTHER tenant. Require BOTH ids to be
    // visible within the caller's tenant (≥1 membership in auth.tenantId). If
    // either is not, return 404 — never reveal cross-tenant existence.
    const primaryVisible = await identityVisibleInTenant(identity, primaryId, auth.tenantId);
    const duplicateVisible = await identityVisibleInTenant(identity, duplicateId, auth.tenantId);
    if (!primaryVisible || !duplicateVisible) {
      return c.json(errBody('IDENTITY_NOT_FOUND', 'identity not found'), 404);
    }

    try {
      const merged = await identity.tenantIdentity.mergeDuplicates(
        primaryId,
        duplicateId,
        auth.tenantId,
      );
      moduleLogger.info('identity_merged', {
        tenantId: auth.tenantId,
        primaryId: parsed.data.primaryId,
        duplicateId: parsed.data.duplicateId,
      });
      return c.json({ success: true, data: { identity: merged } });
    } catch (error) {
      moduleLogger.error('identity_merge_failed', {
        tenantId: auth.tenantId,
        error: (error as Error).message,
      });
      return c.json(errBody('MERGE_FAILED', 'could not merge identities'), 500);
    }
  });

  return app;
}

// ---------------------------------------------------------------------------
// Shared handlers
// ---------------------------------------------------------------------------

/**
 * Verify a membership exists AND lives in the caller's platform tenant.
 * Returns a JSON error Response when the check fails (404 for both
 * not-found and cross-tenant — never reveal cross-tenant existence), or null
 * when the membership is in-tenant and the caller may proceed.
 */
async function assertMembershipInTenant(
  c: Context,
  identity: IdentityServices,
  id: ReturnType<typeof asOrgMembershipId>,
  tenantId: string,
): Promise<Response | null> {
  const membership = await identity.orgMembership.findById(id);
  if (!membership || (membership.platformTenantId as unknown as string) !== tenantId) {
    return c.json(errBody('MEMBERSHIP_NOT_FOUND', 'membership not found'), 404);
  }
  return null;
}

/**
 * True when the given identity has at least one membership in the caller's
 * platform tenant — i.e. it is "visible" to that tenant. Used to gate the
 * cross-org /merge route so a tenant-admin can only merge identities they can
 * actually see, never a stranger's `tid_*` from another tenant.
 */
async function identityVisibleInTenant(
  identity: IdentityServices,
  id: TenantIdentityId,
  tenantId: string,
): Promise<boolean> {
  const memberships = await identity.orgMembership.listForIdentity(id);
  return memberships.some(
    (m) => (m.platformTenantId as unknown as string) === tenantId,
  );
}

/** Map redeem-path domain errors to stable HTTP codes. */
function mapRedeemError(
  c: Context,
  error: unknown,
): Response {
  const message = (error as Error).message ?? '';
  if (message.includes('INVITE_CODE_REVOKED')) {
    return c.json(errBody('INVITE_REVOKED', 'invite code has been revoked'), 410);
  }
  if (message.includes('INVITE_CODE_EXPIRED')) {
    return c.json(errBody('INVITE_EXPIRED', 'invite code has expired'), 410);
  }
  if (message.includes('INVITE_CODE_EXHAUSTED')) {
    return c.json(errBody('INVITE_EXHAUSTED', 'invite code has no redemptions left'), 409);
  }
  if (message.includes('not found')) {
    return c.json(errBody('IDENTITY_NOT_FOUND', 'identity not found'), 404);
  }
  moduleLogger.error('invite_redeem_failed', { error: message });
  return c.json(errBody('INVITE_REDEEM_FAILED', 'could not redeem invite'), 500);
}

export const identityRouter = createIdentityRouter();
export default identityRouter;
