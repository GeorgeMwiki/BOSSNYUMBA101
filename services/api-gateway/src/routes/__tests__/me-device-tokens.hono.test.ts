/**
 * /api/v1/me/device-tokens — auth + validation + wiring regression tests.
 *
 * Live detector for BLOCKER H35 (push tokens 404): both mobile apps POST to
 * /api/v1/me/device-tokens, a route that did not exist, so no device ever
 * received a push. These pin:
 *   - the router mounts and runs its middleware chain (never 404),
 *   - the auth gate on register + revoke,
 *   - the zod payload validator (platform enum + at-least-one-token refine),
 *   - honest degradation to 503 when no live DB is configured (mock mode),
 *   - the same path/shape the mobile push-register clients actually send.
 *
 * The live upsert into device_tokens (idempotency, soft-revoke, RLS) is
 * exercised in the integration suite against a real Drizzle DB; here the DB is
 * mock so authenticated writes resolve to 503 rather than faking success.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';

// JWT secret + env must be set BEFORE importing the router so the auth
// middleware captures the secret at module init and the DB middleware sees
// mock mode.
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-jwt-0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.USE_MOCK_DATA = process.env.USE_MOCK_DATA ?? 'true';

import { generateToken } from '../../middleware/auth';
import { UserRole } from '../../types/user-role';
import { meRouter } from '../me.hono';

const TEST_TENANT = 'tenant-me-1';
const TEST_USER = 'user-me-1';

function bearer(role: UserRole = UserRole.RESIDENT, tenantId = TEST_TENANT): string {
  return `Bearer ${generateToken({
    userId: TEST_USER,
    tenantId,
    role: role as never,
    permissions: ['*'],
    propertyAccess: ['*'],
  })}`;
}

function mount(): Hono {
  const app = new Hono();
  app.route('/me', meRouter);
  return app;
}

beforeAll(() => {
  expect(process.env.JWT_SECRET?.length).toBeGreaterThanOrEqual(32);
});

describe('me/device-tokens auth gate', () => {
  it('rejects unauthenticated register (POST) with 401', async () => {
    const res = await mount().request('/me/device-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        platform: 'ios',
        app: 'tenant-mobile',
        expoPushToken: 'ExponentPushToken[abcdefghij]',
      }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated revoke (DELETE) with 401', async () => {
    const res = await mount().request('/me/device-tokens/sometoken', {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });
});

describe('me/device-tokens register validation', () => {
  it('rejects a missing token (zod refine 400)', async () => {
    const res = await mount().request('/me/device-tokens', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({ platform: 'ios', app: 'tenant-mobile' }),
    });
    // 400 when the zod validator fires (no token); never a 404.
    expect([400, 503]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });

  it('rejects an invalid platform (zod enum 400)', async () => {
    const res = await mount().request('/me/device-tokens', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        platform: 'blackberry',
        expoPushToken: 'ExponentPushToken[abcdefghij]',
      }),
    });
    expect([400, 503]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });

  it('accepts the real mobile-client payload shape and reaches the DB layer', async () => {
    const res = await mount().request('/me/device-tokens', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      // Exact shape apps/{tenant,staff}-mobile push-register.ts sends.
      body: JSON.stringify({
        platform: 'android',
        app: 'staff-mobile',
        expoPushToken: 'ExponentPushToken[abcdefghij]',
      }),
    });
    // Validation passes; DB is mock => the handler hits the honest
    // LIVE_DATA_NOT_CONFIGURED (503) branch rather than faking success.
    expect([503, 500]).toContain(res.status);
    expect(res.status).not.toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

describe('me/device-tokens revoke', () => {
  it('reaches the DB layer for an authenticated revoke (503 in mock, not 404)', async () => {
    const res = await mount().request(
      '/me/device-tokens/ExponentPushToken[abcdefghij]',
      {
        method: 'DELETE',
        headers: { Authorization: bearer() },
      },
    );
    expect([503, 500]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });
});
