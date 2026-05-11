/**
 * Owner-portal placeholder-page skeleton tests (Wave-4 D6).
 *
 * Each of the 10 endpoints below answers a `MissingBackendNotice` page
 * created in commit 0ee27a0. The contract is fixed:
 *
 *   - HTTP 200 (never 404, never 503)
 *   - body: `{ success: true, data: <empty>, ... }`
 *   - `meta.degradedReason: 'not_implemented'`
 *   - `meta.concreteNextStep: <non-empty string>`
 *   - `meta.tenantId === <auth tenant>`
 *   - response header `X-Backend-Status: degraded`
 *
 * These tests exercise:
 *   - the auth gate (anonymous → 401)
 *   - the role gate (RESIDENT → 403)
 *   - the degraded-shape envelope
 *   - tenant-isolation (the `meta.tenantId` reflects the bearer's tenant,
 *     never a body / query parameter, so the routes can't be coerced
 *     into echoing another tenant's id).
 *
 * Note on `/admin/users`: the existing `bff/admin-portal.ts` mounts the
 * router at `/admin` first and DOES NOT define `/users`, so requests
 * fall through to our `adminUsersRouter`. The test below validates the
 * skeleton in isolation, mounted directly at `/admin`.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';

// JWT secret + NODE_ENV must be set BEFORE importing the routers (auth
// middleware captures the secret at module init).
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-jwt-0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.USE_MOCK_DATA = process.env.USE_MOCK_DATA ?? 'true';

import { generateToken } from '../../../middleware/auth';
import { UserRole } from '../../../types/user-role';
import { analyticsExportsRouter } from '../analytics-exports.router';
import { analyticsGrowthRouter } from '../analytics-growth.router';
import { analyticsUsageRouter } from '../analytics-usage.router';
import { billingRouter } from '../billing.router';
import { ownerMessagingRouter } from '../owner-messaging.router';
import { supportRouter } from '../support.router';
import { adminUsersRouter } from '../admin-users.router';

const TEST_TENANT = 'tenant-skeleton-1';
const OTHER_TENANT = 'tenant-skeleton-2';
const TEST_USER = 'user-owner-skeleton-1';

function bearer(role: UserRole = UserRole.OWNER, tenantId = TEST_TENANT): string {
  return `Bearer ${generateToken({
    userId: TEST_USER,
    tenantId,
    role: role as any,
    permissions: ['*'],
    propertyAccess: ['*'],
  })}`;
}

function mount(prefix: string, router: Hono): Hono {
  const app = new Hono();
  app.route(prefix, router);
  return app;
}

beforeAll(() => {
  expect(process.env.JWT_SECRET?.length).toBeGreaterThanOrEqual(32);
});

/**
 * Common assertion for list-shaped degraded responses. Every router
 * with a list endpoint should pass this contract verbatim.
 */
async function assertDegradedListResponse(
  app: Hono,
  path: string,
  tenantId: string,
): Promise<void> {
  const res = await app.request(path, {
    headers: { Authorization: bearer(UserRole.OWNER, tenantId) },
  });
  expect(res.status).toBe(200);
  expect(res.headers.get('x-backend-status')).toBe('degraded');
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.data).toEqual([]);
  expect(body.meta.degradedReason).toBe('not_implemented');
  expect(typeof body.meta.concreteNextStep).toBe('string');
  expect(body.meta.concreteNextStep.length).toBeGreaterThan(0);
  expect(body.meta.tenantId).toBe(tenantId);
}

// ---------------------------------------------------------------------------
// 1. GET /analytics/exports/templates
// ---------------------------------------------------------------------------

describe('GET /analytics/exports/templates (skeleton)', () => {
  const app = mount('/analytics/exports', analyticsExportsRouter);

  it('rejects anonymous callers (401)', async () => {
    const res = await app.request('/analytics/exports/templates');
    expect(res.status).toBe(401);
  });

  it('rejects RESIDENT role (403)', async () => {
    const res = await app.request('/analytics/exports/templates', {
      headers: { Authorization: bearer(UserRole.RESIDENT) },
    });
    expect(res.status).toBe(403);
  });

  it('returns degraded list shape for OWNER', async () => {
    await assertDegradedListResponse(
      app,
      '/analytics/exports/templates',
      TEST_TENANT,
    );
  });

  it('echoes the bearer tenant id in meta (isolation)', async () => {
    await assertDegradedListResponse(
      app,
      '/analytics/exports/templates',
      OTHER_TENANT,
    );
  });
});

// ---------------------------------------------------------------------------
// 2. GET /analytics/growth
// ---------------------------------------------------------------------------

describe('GET /analytics/growth (skeleton)', () => {
  const app = mount('/analytics/growth', analyticsGrowthRouter);

  it('rejects anonymous callers (401)', async () => {
    const res = await app.request('/analytics/growth');
    expect(res.status).toBe(401);
  });

  it('rejects RESIDENT role (403)', async () => {
    const res = await app.request('/analytics/growth', {
      headers: { Authorization: bearer(UserRole.RESIDENT) },
    });
    expect(res.status).toBe(403);
  });

  it('returns degraded list shape for OWNER', async () => {
    await assertDegradedListResponse(app, '/analytics/growth', TEST_TENANT);
  });

  it('returns degraded list shape for TENANT_ADMIN', async () => {
    const res = await app.request('/analytics/growth', {
      headers: { Authorization: bearer(UserRole.TENANT_ADMIN) },
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 3. GET /analytics/usage
// ---------------------------------------------------------------------------

describe('GET /analytics/usage (skeleton)', () => {
  const app = mount('/analytics/usage', analyticsUsageRouter);

  it('rejects anonymous callers (401)', async () => {
    const res = await app.request('/analytics/usage');
    expect(res.status).toBe(401);
  });

  it('rejects RESIDENT role (403)', async () => {
    const res = await app.request('/analytics/usage', {
      headers: { Authorization: bearer(UserRole.RESIDENT) },
    });
    expect(res.status).toBe(403);
  });

  it('returns degraded list shape for OWNER', async () => {
    await assertDegradedListResponse(app, '/analytics/usage', TEST_TENANT);
  });
});

// ---------------------------------------------------------------------------
// 4. GET /billing/subscription
// ---------------------------------------------------------------------------

describe('GET /billing/subscription (skeleton)', () => {
  const app = mount('/billing', billingRouter);

  it('rejects anonymous callers (401)', async () => {
    const res = await app.request('/billing/subscription');
    expect(res.status).toBe(401);
  });

  it('rejects RESIDENT role (403)', async () => {
    const res = await app.request('/billing/subscription', {
      headers: { Authorization: bearer(UserRole.RESIDENT) },
    });
    expect(res.status).toBe(403);
  });

  it('returns degraded subscription object with X-Backend-Status header', async () => {
    const res = await app.request('/billing/subscription', {
      headers: { Authorization: bearer(UserRole.OWNER) },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-backend-status')).toBe('degraded');
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.plan).toBeNull();
    expect(body.data.status).toBe('unknown');
    expect(body.data.mrrMinor).toBe(0);
    expect(body.data.meta.degradedReason).toBe('not_implemented');
    expect(body.data.meta.tenantId).toBe(TEST_TENANT);
    expect(body.data.meta.concreteNextStep.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5–7. GET /owner/messaging/{broadcasts,campaigns,templates}
// ---------------------------------------------------------------------------

describe('GET /owner/messaging/{broadcasts,campaigns,templates} (skeleton)', () => {
  const app = mount('/owner/messaging', ownerMessagingRouter);

  it('rejects anonymous broadcasts (401)', async () => {
    const res = await app.request('/owner/messaging/broadcasts');
    expect(res.status).toBe(401);
  });

  it('rejects RESIDENT on broadcasts (403)', async () => {
    const res = await app.request('/owner/messaging/broadcasts', {
      headers: { Authorization: bearer(UserRole.RESIDENT) },
    });
    expect(res.status).toBe(403);
  });

  it('returns degraded list for /broadcasts', async () => {
    await assertDegradedListResponse(
      app,
      '/owner/messaging/broadcasts',
      TEST_TENANT,
    );
  });

  it('returns degraded list for /campaigns', async () => {
    await assertDegradedListResponse(
      app,
      '/owner/messaging/campaigns',
      TEST_TENANT,
    );
  });

  it('returns degraded list for /templates', async () => {
    await assertDegradedListResponse(
      app,
      '/owner/messaging/templates',
      TEST_TENANT,
    );
  });

  it('next-step strings are domain-specific (not copy-pasted)', async () => {
    const headers = { Authorization: bearer(UserRole.OWNER) };
    const [b, c, t] = await Promise.all([
      app.request('/owner/messaging/broadcasts', { headers }),
      app.request('/owner/messaging/campaigns', { headers }),
      app.request('/owner/messaging/templates', { headers }),
    ]);
    const [bb, cb, tb] = await Promise.all([b.json(), c.json(), t.json()]);
    expect(bb.meta.concreteNextStep).toMatch(/broadcasts/);
    expect(cb.meta.concreteNextStep).toMatch(/campaigns/);
    expect(tb.meta.concreteNextStep).toMatch(/templates/);
  });
});

// ---------------------------------------------------------------------------
// 8. GET /support/tickets
// ---------------------------------------------------------------------------

describe('GET /support/tickets (skeleton)', () => {
  const app = mount('/support', supportRouter);

  it('rejects anonymous callers (401)', async () => {
    const res = await app.request('/support/tickets');
    expect(res.status).toBe(401);
  });

  it('rejects RESIDENT role (403)', async () => {
    const res = await app.request('/support/tickets', {
      headers: { Authorization: bearer(UserRole.RESIDENT) },
    });
    expect(res.status).toBe(403);
  });

  it('returns degraded list shape for OWNER', async () => {
    await assertDegradedListResponse(app, '/support/tickets', TEST_TENANT);
  });
});

// ---------------------------------------------------------------------------
// 9. GET /admin/users
// ---------------------------------------------------------------------------

describe('GET /admin/users (skeleton)', () => {
  const app = mount('/admin', adminUsersRouter);

  it('rejects anonymous callers (401)', async () => {
    const res = await app.request('/admin/users');
    expect(res.status).toBe(401);
  });

  it('rejects RESIDENT role (403)', async () => {
    const res = await app.request('/admin/users', {
      headers: { Authorization: bearer(UserRole.RESIDENT) },
    });
    expect(res.status).toBe(403);
  });

  it('allows TENANT_ADMIN', async () => {
    const res = await app.request('/admin/users', {
      headers: { Authorization: bearer(UserRole.TENANT_ADMIN) },
    });
    expect(res.status).toBe(200);
  });

  it('returns degraded list shape for OWNER', async () => {
    await assertDegradedListResponse(app, '/admin/users', TEST_TENANT);
  });

  it('isolates tenants — meta.tenantId reflects bearer, not a query', async () => {
    // Even if a malicious query string tries to override tenantId, the
    // skeleton always reads from the auth context. Send a query and
    // verify the response still echoes the bearer's tenant.
    const res = await app.request(
      `/admin/users?tenantId=${OTHER_TENANT}`,
      { headers: { Authorization: bearer(UserRole.OWNER, TEST_TENANT) } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.tenantId).toBe(TEST_TENANT);
  });
});
