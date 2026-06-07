/**
 * identity.hono — route-layer tests for the cross-org identity surface (#12).
 *
 * Covers the security-critical contracts:
 *   1. auth gates — every endpoint rejects anonymous callers (401).
 *   2. tenant-scoping — a code/membership in another platform tenant is
 *      invisible (404), and a client-supplied tenantId is never trusted.
 *   3. invite redeem — happy path + revoked/expired/exhausted mapping.
 *   4. org join (membership) — list is tenant-filtered; leave/block enforce
 *      that the membership lives in the caller's tenant.
 *   5. role gates — generate/revoke/block/merge require an admin role.
 *
 * Strategy: the identity services are mocked at the service boundary and
 * injected on `c.get('services').identity` (the same slice the production
 * context middleware sets). A real HS256 JWT is minted so the production
 * `authMiddleware` runs unmodified.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';

process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'test-secret-jwt-0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.BOSSNYUMBA_SKIP_DOTENV = 'true';

import { createIdentityRouter } from '../identity.hono';
import { generateToken } from '../../middleware/auth';
import { UserRole } from '../../types/user-role';
import { OtpResendThrottledError } from '@bossnyumba/identity';

const TENANT_A = 'tnt_acme';
const TENANT_B = 'tnt_beta';
const ORG_A = 'org_acme';

// ── Mock identity services ──────────────────────────────────────────────

interface MockState {
  inviteByCode: Map<string, { platformTenantId: string; redeemable: boolean }>;
  membershipById: Map<string, { platformTenantId: string }>;
  membershipsByIdentity: Map<string, ReadonlyArray<{ id: string; platformTenantId: string }>>;
  redeemError?: string;
  /** When set, otp.send() throws this — used to exercise the throttle path. */
  otpSendError?: Error;
  calls: string[];
}

function makeIdentityServices(state: MockState) {
  return {
    defaultCountryCode: 'TZ',
    inviteCode: {
      async generate(orgId: string, issuedBy: string) {
        state.calls.push(`generate:${orgId}:${issuedBy}`);
        return {
          code: `${orgId.toUpperCase().slice(0, 4)}-AB12`,
          organizationId: orgId,
          platformTenantId: TENANT_A,
          issuedBy,
          issuedAt: '2026-06-07T00:00:00.000Z',
          expiresAt: null,
          maxRedemptions: null,
          redemptionsUsed: 0,
          defaultRoleId: 'role_tenant',
        };
      },
      async listForOrg(orgId: string) {
        state.calls.push(`listForOrg:${orgId}`);
        return [
          {
            code: 'ACME-AB12',
            organizationId: orgId,
            platformTenantId: TENANT_A,
            issuedBy: 'usr_admin',
            issuedAt: '2026-06-07T00:00:00.000Z',
            expiresAt: null,
            maxRedemptions: null,
            redemptionsUsed: 0,
            defaultRoleId: 'role_tenant',
          },
        ];
      },
      async findByCode(code: string) {
        const found = state.inviteByCode.get(code);
        if (!found) return null;
        return {
          code,
          organizationId: ORG_A,
          platformTenantId: found.platformTenantId,
          issuedBy: 'usr_admin',
          issuedAt: '2026-06-07T00:00:00.000Z',
          expiresAt: null,
          maxRedemptions: null,
          redemptionsUsed: 0,
          defaultRoleId: 'role_tenant',
        };
      },
      async redeem(code: string, tenantIdentityId: string) {
        state.calls.push(`redeem:${code}:${tenantIdentityId}`);
        if (state.redeemError) throw new Error(state.redeemError);
        return {
          membership: {
            id: 'mem_new',
            tenantIdentityId,
            organizationId: ORG_A,
            platformTenantId: TENANT_A,
            userId: 'usr_shadow',
            status: 'ACTIVE',
            nickname: null,
            joinedViaInviteCode: code,
            joinedAt: '2026-06-07T00:00:00.000Z',
          },
          code: {
            code,
            organizationId: ORG_A,
            platformTenantId: TENANT_A,
            issuedBy: 'usr_admin',
            issuedAt: '2026-06-07T00:00:00.000Z',
            expiresAt: null,
            maxRedemptions: null,
            redemptionsUsed: 1,
            defaultRoleId: 'role_tenant',
          },
        };
      },
      async revoke(code: string) {
        state.calls.push(`revoke:${code}`);
        return {
          code,
          organizationId: ORG_A,
          platformTenantId: TENANT_A,
          issuedBy: 'usr_admin',
          issuedAt: '2026-06-07T00:00:00.000Z',
          expiresAt: null,
          maxRedemptions: null,
          redemptionsUsed: 0,
          defaultRoleId: 'role_tenant',
        };
      },
    },
    orgMembership: {
      async findById(id: string) {
        const found = state.membershipById.get(id);
        if (!found) return null;
        return {
          id,
          tenantIdentityId: 'tid_1',
          organizationId: ORG_A,
          platformTenantId: found.platformTenantId,
          userId: 'usr_shadow',
          status: 'ACTIVE',
          nickname: null,
          joinedViaInviteCode: null,
          joinedAt: '2026-06-07T00:00:00.000Z',
        };
      },
      async listForIdentity(identityId: string) {
        state.calls.push(`listForIdentity:${identityId}`);
        const rows = state.membershipsByIdentity.get(identityId) ?? [];
        return rows.map((r) => ({
          id: r.id,
          tenantIdentityId: identityId,
          organizationId: ORG_A,
          platformTenantId: r.platformTenantId,
          userId: 'usr_shadow',
          status: 'ACTIVE',
          nickname: null,
          joinedViaInviteCode: null,
          joinedAt: '2026-06-07T00:00:00.000Z',
        }));
      },
      async leaveMembership(id: string) {
        state.calls.push(`leave:${id}`);
        return {
          id,
          tenantIdentityId: 'tid_1',
          organizationId: ORG_A,
          platformTenantId: TENANT_A,
          userId: 'usr_shadow',
          status: 'LEFT',
          nickname: null,
          joinedViaInviteCode: null,
          joinedAt: '2026-06-07T00:00:00.000Z',
        };
      },
      async blockMembership(id: string, reason: string) {
        state.calls.push(`block:${id}:${reason}`);
        return {
          id,
          tenantIdentityId: 'tid_1',
          organizationId: ORG_A,
          platformTenantId: TENANT_A,
          userId: 'usr_shadow',
          status: 'BLOCKED',
          nickname: null,
          joinedViaInviteCode: null,
          joinedAt: '2026-06-07T00:00:00.000Z',
        };
      },
    },
    tenantIdentity: {
      async createOrUpsertByPhone() {
        return { id: 'tid_new', phoneNormalized: '255700000000' };
      },
      async verifyPhoneOTP() {
        return { verified: true, identity: { id: 'tid_new' } };
      },
      async mergeDuplicates(
        primaryId: string,
        duplicateId: string,
        platformTenantId: string,
      ) {
        // Capture all three args so tests can assert the tenant is threaded.
        state.calls.push(`merge:${primaryId}:${duplicateId}:${platformTenantId}`);
        return { id: primaryId, status: 'ACTIVE' };
      },
    },
    otp: {
      async send() {
        if (state.otpSendError) throw state.otpSendError;
        return { expiresAt: Date.now() + 60000 };
      },
    },
  };
}

// ── Mock DB (org resolution) ────────────────────────────────────────────

/**
 * Reconstruct the readable SQL text from a Drizzle `sql` object by joining its
 * StringChunk fragments (param placeholders are omitted — we only need the
 * table name to route the mock). This is stable across drizzle-orm versions
 * that expose `queryChunks` with `StringChunk { value: string[] }`.
 */
function sqlText(q: unknown): string {
  const chunks = (q as { queryChunks?: ReadonlyArray<{ value?: unknown }> })
    .queryChunks;
  if (!Array.isArray(chunks)) return String(q);
  let out = '';
  for (const c of chunks) {
    if (c && Array.isArray((c as { value?: unknown }).value)) {
      out += ((c as { value: unknown[] }).value as unknown[]).join('');
    }
  }
  return out;
}

function makeMockDb(orgRowTenant: string | null) {
  return {
    async execute(q: unknown) {
      const text = sqlText(q);
      // The org-resolution + org-belongs queries select from users /
      // organizations. Return the caller's org for the users lookup, and a
      // single row for organizations only when the tenant matches.
      if (/from\s+users/i.test(text)) {
        return orgRowTenant ? [{ organization_id: ORG_A }] : [];
      }
      if (/from\s+organizations/i.test(text)) {
        // Used by orgBelongsToTenant — return a row to signal "belongs".
        return [{ '1': 1 }];
      }
      return [];
    },
  };
}

function mount(state: MockState, opts: { orgRowTenant?: string | null } = {}): Hono {
  const services = makeIdentityServices(state);
  const db = makeMockDb(opts.orgRowTenant === undefined ? TENANT_A : opts.orgRowTenant);
  const app = new Hono();
  // Inject mock db + identity services BEFORE the router's own auth/db
  // middleware (databaseMiddleware honours a pre-injected `db`).
  app.use('*', async (c, next) => {
    c.set('db', db as never);
    c.set('services', { identity: services } as never);
    await next();
  });
  app.route('/identity', createIdentityRouter());
  return app;
}

function bearer(
  role: UserRole,
  opts: { tenantId?: string } = {},
): string {
  return `Bearer ${generateToken({
    userId: 'usr_caller',
    tenantId: opts.tenantId ?? TENANT_A,
    role: role as never,
    permissions: [],
    propertyAccess: ['*'],
  })}`;
}

function emptyState(): MockState {
  return {
    inviteByCode: new Map(),
    membershipById: new Map(),
    membershipsByIdentity: new Map(),
    calls: [],
  };
}

describe('identity.hono — auth gates', () => {
  beforeAll(() => {
    expect(process.env.JWT_SECRET?.length ?? 0).toBeGreaterThanOrEqual(32);
  });

  it('rejects anonymous POST /invites with 401', async () => {
    const res = await mount(emptyState()).request('/identity/invites', {
      method: 'POST',
      body: JSON.stringify({ defaultRoleId: 'role_tenant' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it('rejects anonymous GET /memberships with 401', async () => {
    const res = await mount(emptyState()).request('/identity/memberships?identityId=tid_1');
    expect(res.status).toBe(401);
  });

  it('rejects anonymous POST /onboard/phone/start with 401', async () => {
    const res = await mount(emptyState()).request('/identity/onboard/phone/start', {
      method: 'POST',
      body: JSON.stringify({ phone: '0700000000' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });
});

describe('identity.hono — role gates', () => {
  it('non-admin cannot generate an invite (403)', async () => {
    const res = await mount(emptyState()).request('/identity/invites', {
      method: 'POST',
      body: JSON.stringify({ defaultRoleId: 'role_tenant' }),
      headers: { 'content-type': 'application/json', Authorization: bearer(UserRole.OWNER) },
    });
    expect(res.status).toBe(403);
  });

  it('admin can generate an invite for their own org (201)', async () => {
    const state = emptyState();
    const res = await mount(state).request('/identity/invites', {
      method: 'POST',
      body: JSON.stringify({ defaultRoleId: 'role_tenant' }),
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(UserRole.TENANT_ADMIN),
      },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: { invite: { code: string } } };
    expect(body.success).toBe(true);
    expect(body.data.invite.code).toContain('-');
    expect(state.calls.some((c) => c.startsWith('generate:'))).toBe(true);
  });
});

describe('identity.hono — tenant scoping (no cross-tenant leakage)', () => {
  it('redeem of an out-of-tenant code returns 404 (not revealed)', async () => {
    const state = emptyState();
    // Code physically exists but belongs to TENANT_B.
    state.inviteByCode.set('BETA-XX99', { platformTenantId: TENANT_B, redeemable: true });
    const res = await mount(state).request('/identity/invites/redeem', {
      method: 'POST',
      body: JSON.stringify({ code: 'BETA-XX99', tenantIdentityId: 'tid_1' }),
      headers: {
        'content-type': 'application/json',
        // caller is in TENANT_A
        Authorization: bearer(UserRole.TENANT_ADMIN, { tenantId: TENANT_A }),
      },
    });
    expect(res.status).toBe(404);
    // redeem() must NOT have been called — scope check rejects first.
    expect(state.calls.some((c) => c.startsWith('redeem:'))).toBe(false);
  });

  it('leave of an out-of-tenant membership returns 404 and never mutates', async () => {
    const state = emptyState();
    state.membershipById.set('mem_other', { platformTenantId: TENANT_B });
    const res = await mount(state).request('/identity/memberships/mem_other/leave', {
      method: 'POST',
      headers: { Authorization: bearer(UserRole.TENANT_ADMIN, { tenantId: TENANT_A }) },
    });
    expect(res.status).toBe(404);
    expect(state.calls.some((c) => c.startsWith('leave:'))).toBe(false);
  });

  it('GET /memberships filters out rows from other tenants', async () => {
    const state = emptyState();
    state.membershipsByIdentity.set('tid_1', [
      { id: 'mem_a', platformTenantId: TENANT_A },
      { id: 'mem_b', platformTenantId: TENANT_B },
    ]);
    const res = await mount(state).request('/identity/memberships?identityId=tid_1', {
      headers: { Authorization: bearer(UserRole.TENANT_ADMIN, { tenantId: TENANT_A }) },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { memberships: ReadonlyArray<{ id: string }> } };
    expect(body.data.memberships).toHaveLength(1);
    expect(body.data.memberships[0].id).toBe('mem_a');
  });
});

describe('identity.hono — invite redeem (org join)', () => {
  it('redeems an in-tenant code and returns the new membership (201)', async () => {
    const state = emptyState();
    state.inviteByCode.set('ACME-AB12', { platformTenantId: TENANT_A, redeemable: true });
    const res = await mount(state).request('/identity/invites/redeem', {
      method: 'POST',
      body: JSON.stringify({ code: 'ACME-AB12', tenantIdentityId: 'tid_1' }),
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(UserRole.TENANT_ADMIN, { tenantId: TENANT_A }),
      },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { membership: { id: string; status: string; organizationId: string } };
    };
    expect(body.data.membership.id).toBe('mem_new');
    expect(body.data.membership.status).toBe('ACTIVE');
    expect(state.calls).toContain('redeem:ACME-AB12:tid_1');
  });

  it('maps a revoked code to 410 INVITE_REVOKED', async () => {
    const state = emptyState();
    state.inviteByCode.set('ACME-AB12', { platformTenantId: TENANT_A, redeemable: false });
    state.redeemError = 'INVITE_CODE_REVOKED';
    const res = await mount(state).request('/identity/invites/redeem', {
      method: 'POST',
      body: JSON.stringify({ code: 'ACME-AB12', tenantIdentityId: 'tid_1' }),
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(UserRole.TENANT_ADMIN, { tenantId: TENANT_A }),
      },
    });
    expect(res.status).toBe(410);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVITE_REVOKED');
  });

  it('maps an exhausted code to 409 INVITE_EXHAUSTED', async () => {
    const state = emptyState();
    state.inviteByCode.set('ACME-AB12', { platformTenantId: TENANT_A, redeemable: false });
    state.redeemError = 'INVITE_CODE_EXHAUSTED';
    const res = await mount(state).request('/identity/invites/redeem', {
      method: 'POST',
      body: JSON.stringify({ code: 'ACME-AB12', tenantIdentityId: 'tid_1' }),
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(UserRole.TENANT_ADMIN, { tenantId: TENANT_A }),
      },
    });
    expect(res.status).toBe(409);
  });
});

describe('identity.hono — membership block + leave (admin)', () => {
  it('admin blocks an in-tenant membership (200)', async () => {
    const state = emptyState();
    state.membershipById.set('mem_a', { platformTenantId: TENANT_A });
    const res = await mount(state).request('/identity/memberships/mem_a/block', {
      method: 'POST',
      body: JSON.stringify({ reason: 'policy violation' }),
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(UserRole.TENANT_ADMIN, { tenantId: TENANT_A }),
      },
    });
    expect(res.status).toBe(200);
    expect(state.calls).toContain('block:mem_a:policy violation');
  });

  it('non-admin cannot block (403)', async () => {
    const state = emptyState();
    state.membershipById.set('mem_a', { platformTenantId: TENANT_A });
    const res = await mount(state).request('/identity/memberships/mem_a/block', {
      method: 'POST',
      body: JSON.stringify({ reason: 'nope' }),
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(UserRole.OWNER, { tenantId: TENANT_A }),
      },
    });
    expect(res.status).toBe(403);
  });

  it('leave succeeds for an in-tenant membership (200)', async () => {
    const state = emptyState();
    state.membershipById.set('mem_a', { platformTenantId: TENANT_A });
    const res = await mount(state).request('/identity/memberships/mem_a/leave', {
      method: 'POST',
      headers: { Authorization: bearer(UserRole.TENANT_ADMIN, { tenantId: TENANT_A }) },
    });
    expect(res.status).toBe(200);
    expect(state.calls).toContain('leave:mem_a');
  });
});

describe('identity.hono — phone OTP onboarding', () => {
  it('starts onboarding and returns the identity id without leaking the code (202)', async () => {
    const res = await mount(emptyState()).request('/identity/onboard/phone/start', {
      method: 'POST',
      body: JSON.stringify({ phone: '0700000000', countryCode: 'TZ' }),
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(UserRole.TENANT_ADMIN),
      },
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data.tenantIdentityId).toBe('tid_new');
    // No OTP code or phone in the response.
    expect(JSON.stringify(body)).not.toMatch(/\bcode\b/);
  });

  it('verifies an OTP and returns the identity (200)', async () => {
    const res = await mount(emptyState()).request('/identity/onboard/phone/verify', {
      method: 'POST',
      body: JSON.stringify({ tenantIdentityId: 'tid_new', code: '123456' }),
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(UserRole.TENANT_ADMIN),
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { identity: { id: string } } };
    expect(body.data.identity.id).toBe('tid_new');
  });
});

// ── H-1: /onboard/phone/start gating + uniform-202 (no enumeration oracle) ──
describe('identity.hono — phone OTP onboarding gating (H-1)', () => {
  it('rejects a non-admin (RESIDENT) with 403', async () => {
    const res = await mount(emptyState()).request('/identity/onboard/phone/start', {
      method: 'POST',
      body: JSON.stringify({ phone: '0700000000', countryCode: 'TZ' }),
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(UserRole.RESIDENT),
      },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns a UNIFORM 202 (not 429) when the OTP send is throttled', async () => {
    const state = emptyState();
    // Simulate the per-phone resend throttle firing on dispatch.
    state.otpSendError = new OtpResendThrottledError(30_000, 'cooldown');
    const res = await mount(state).request('/identity/onboard/phone/start', {
      method: 'POST',
      body: JSON.stringify({ phone: '0700000000', countryCode: 'TZ' }),
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(UserRole.TENANT_ADMIN),
      },
    });
    // The throttled response is INDISTINGUISHABLE from a fresh send: same 202,
    // same body shape, no retryAfter — so it cannot be a registration oracle.
    expect(res.status).toBe(202);
    const body = (await res.json()) as { success: boolean; data: { tenantIdentityId: string } };
    expect(body.success).toBe(true);
    expect(body.data.tenantIdentityId).toBe('tid_new');
    expect(JSON.stringify(body)).not.toMatch(/retry/i);
  });

  it('the fresh-send and throttled-send responses are byte-identical', async () => {
    const fresh = await mount(emptyState()).request('/identity/onboard/phone/start', {
      method: 'POST',
      body: JSON.stringify({ phone: '0700000000', countryCode: 'TZ' }),
      headers: { 'content-type': 'application/json', Authorization: bearer(UserRole.TENANT_ADMIN) },
    });
    const throttledState = emptyState();
    throttledState.otpSendError = new OtpResendThrottledError(30_000, 'hourly_cap');
    const throttled = await mount(throttledState).request('/identity/onboard/phone/start', {
      method: 'POST',
      body: JSON.stringify({ phone: '0700000000', countryCode: 'TZ' }),
      headers: { 'content-type': 'application/json', Authorization: bearer(UserRole.TENANT_ADMIN) },
    });
    expect(throttled.status).toBe(fresh.status);
    expect(await throttled.text()).toBe(await fresh.text());
  });
});

// ── C-1: /merge tenant isolation (cross-tenant identity hijack) ──────────────
describe('identity.hono — merge tenant isolation (C-1)', () => {
  it('returns 404 and never calls mergeDuplicates when an id has no membership in the caller tenant', async () => {
    const state = emptyState();
    // primary is visible in TENANT_A; duplicate lives entirely in TENANT_B.
    state.membershipsByIdentity.set('tid_primary', [
      { id: 'mem_p', platformTenantId: TENANT_A },
    ]);
    state.membershipsByIdentity.set('tid_dupe', [
      { id: 'mem_d', platformTenantId: TENANT_B },
    ]);
    const res = await mount(state).request('/identity/merge', {
      method: 'POST',
      body: JSON.stringify({ primaryId: 'tid_primary', duplicateId: 'tid_dupe' }),
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(UserRole.TENANT_ADMIN, { tenantId: TENANT_A }),
      },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('IDENTITY_NOT_FOUND');
    // The merge must NOT have been attempted — ownership check rejects first.
    expect(state.calls.some((c) => c.startsWith('merge:'))).toBe(false);
  });

  it('returns 404 when an id has NO memberships at all (unknown / cross-tenant tid)', async () => {
    const state = emptyState();
    state.membershipsByIdentity.set('tid_primary', [
      { id: 'mem_p', platformTenantId: TENANT_A },
    ]);
    // tid_ghost has no memberships recorded anywhere.
    const res = await mount(state).request('/identity/merge', {
      method: 'POST',
      body: JSON.stringify({ primaryId: 'tid_primary', duplicateId: 'tid_ghost' }),
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(UserRole.TENANT_ADMIN, { tenantId: TENANT_A }),
      },
    });
    expect(res.status).toBe(404);
    expect(state.calls.some((c) => c.startsWith('merge:'))).toBe(false);
  });

  it('succeeds for a same-tenant merge and threads the caller tenant to the repo', async () => {
    const state = emptyState();
    state.membershipsByIdentity.set('tid_primary', [
      { id: 'mem_p', platformTenantId: TENANT_A },
    ]);
    state.membershipsByIdentity.set('tid_dupe', [
      { id: 'mem_d', platformTenantId: TENANT_A },
    ]);
    const res = await mount(state).request('/identity/merge', {
      method: 'POST',
      body: JSON.stringify({ primaryId: 'tid_primary', duplicateId: 'tid_dupe' }),
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(UserRole.TENANT_ADMIN, { tenantId: TENANT_A }),
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { identity: { id: string } } };
    expect(body.success).toBe(true);
    expect(body.data.identity.id).toBe('tid_primary');
    // The caller's tenant (TENANT_A) MUST be the 3rd arg passed to the repo.
    expect(state.calls).toContain(`merge:tid_primary:tid_dupe:${TENANT_A}`);
  });

  it('still enforces the admin gate (non-admin → 403, no membership lookups)', async () => {
    const state = emptyState();
    const res = await mount(state).request('/identity/merge', {
      method: 'POST',
      body: JSON.stringify({ primaryId: 'tid_primary', duplicateId: 'tid_dupe' }),
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(UserRole.OWNER, { tenantId: TENANT_A }),
      },
    });
    expect(res.status).toBe(403);
    // Reject before any identity resolution.
    expect(state.calls.some((c) => c.startsWith('listForIdentity:'))).toBe(false);
    expect(state.calls.some((c) => c.startsWith('merge:'))).toBe(false);
  });
});
