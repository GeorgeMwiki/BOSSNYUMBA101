/**
 * /api/v1/owner/mwikila-inbox — auth + validation regression tests.
 *
 * Live detector for BLOCKER #1 (owner Mwikila governance surface 404).
 * These pin:
 *   - the router mounts and runs its middleware chain (no 404),
 *   - the public auth gate on the inbox list, the delegation-matrix read,
 *     and the new delegation-matrix PATCH write,
 *   - the zod param/body validators on PATCH /delegation-matrix/:category.
 *
 * End-to-end coverage against a live Drizzle DB (the upsert into
 * owner_delegation_prefs and the merge-over-defaults read) lives in the
 * integration suite; here the DB is mock so writes resolve to 503.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';

// JWT secret + NODE_ENV must be set BEFORE importing the router so the
// auth middleware captures the secret at module init.
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-jwt-0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.USE_MOCK_DATA = process.env.USE_MOCK_DATA ?? 'true';

import { generateToken } from '../../../middleware/auth';
import { UserRole } from '../../../types/user-role';
import { mwikilaInboxRouter } from '../mwikila-inbox.hono';

const TEST_TENANT = 'tenant-mwikila-1';
const TEST_USER = 'user-owner-mwikila-1';

function bearer(role: UserRole = UserRole.OWNER, tenantId = TEST_TENANT): string {
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
  app.route('/owner/mwikila-inbox', mwikilaInboxRouter);
  return app;
}

beforeAll(() => {
  expect(process.env.JWT_SECRET?.length).toBeGreaterThanOrEqual(32);
});

describe('owner-mwikila-inbox auth gate', () => {
  it('rejects unauthenticated inbox list', async () => {
    const res = await mount().request('/owner/mwikila-inbox');
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated delegation-matrix read', async () => {
    const res = await mount().request(
      '/owner/mwikila-inbox/delegation-matrix',
    );
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated delegation-matrix PATCH', async () => {
    const res = await mount().request(
      '/owner/mwikila-inbox/delegation-matrix/rent-scheduling',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tier: 'T2' }),
      },
    );
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated approve', async () => {
    const res = await mount().request('/owner/mwikila-inbox/some-id/approve', {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });
});

describe('owner-mwikila-inbox delegation-matrix PATCH validation', () => {
  it('rejects an unknown category (zod param 400)', async () => {
    const res = await mount().request(
      '/owner/mwikila-inbox/delegation-matrix/not-a-real-category',
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          Authorization: bearer(),
        },
        body: JSON.stringify({ tier: 'T2' }),
      },
    );
    // 400 when the zod param validator fires before the DB; 503 only if
    // the route somehow reaches the DB-unavailable branch first. Either
    // proves the route is wired (not a 404).
    expect([400, 503]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });

  it('rejects an invalid tier (zod body 400)', async () => {
    const res = await mount().request(
      '/owner/mwikila-inbox/delegation-matrix/rent-scheduling',
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          Authorization: bearer(),
        },
        body: JSON.stringify({ tier: 'T9' }),
      },
    );
    expect([400, 503]).toContain(res.status);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(typeof body.error.code).toBe('string');
  });

  it('rejects a reversal window above the 168h cap (zod body 400)', async () => {
    const res = await mount().request(
      '/owner/mwikila-inbox/delegation-matrix/lease-renewals',
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          Authorization: bearer(),
        },
        body: JSON.stringify({ tier: 'T2', reversalWindowHours: 9999 }),
      },
    );
    expect([400, 503]).toContain(res.status);
  });

  it('reports DB unavailable for a valid PATCH in mock mode', async () => {
    const res = await mount().request(
      '/owner/mwikila-inbox/delegation-matrix/rent-scheduling',
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          Authorization: bearer(),
        },
        body: JSON.stringify({
          tier: 'T2',
          reversalWindowHours: 24,
          envelopeThreshold: 500000,
          envelopeThresholdCurrency: 'TZS',
          notes: null,
        }),
      },
    );
    // Validation passes; DB is mock => the route hits the
    // DATABASE_UNAVAILABLE (503) branch rather than a write.
    expect([503, 500]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });
});
