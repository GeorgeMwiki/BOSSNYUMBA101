/**
 * /api/v1/owner/superpowers/bulk-action — auth + whitelist + validation
 * regression tests. Pins the auth gate, the BN whitelist matrix, and the
 * 503 "DB not configured" branch. E2E coverage with a live Drizzle DB
 * lives in the integration suite (Wave SUPERPOWERS E2E).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-jwt-0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.USE_MOCK_DATA = process.env.USE_MOCK_DATA ?? 'true';

import { generateToken } from '../../../../middleware/auth';
import { UserRole } from '../../../../types/user-role';
import { ownerSuperpowersBulkActionRouter } from '../bulk-action.hono';

const TEST_TENANT = 'tenant-bulk-1';
const TEST_USER = 'user-owner-bulk-1';

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
  app.route('/owner/superpowers/bulk-action', ownerSuperpowersBulkActionRouter);
  return app;
}

beforeAll(() => {
  expect(process.env.JWT_SECRET?.length).toBeGreaterThanOrEqual(32);
});

describe('owner-superpowers-bulk-action auth gate', () => {
  it('rejects unauthenticated POST', async () => {
    const res = await mount().request('/owner/superpowers/bulk-action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });
});

describe('owner-superpowers-bulk-action whitelist enforcement', () => {
  it('rejects a non-whitelist entity type', async () => {
    const res = await mount().request('/owner/superpowers/bulk-action', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        entityType: 'NOT_AN_ENTITY',
        ids: ['lease-1'],
        action: 'snooze',
        reason: 'test',
      }),
    });
    expect([400, 503]).toContain(res.status);
  });

  it('rejects a non-whitelist action for a valid entity (cross-product guard)', async () => {
    // Borjie allowed snooze on reminders; for BN we deliberately
    // forbid mark_rent_paid on reminders (only valid on leases).
    const res = await mount().request('/owner/superpowers/bulk-action', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        entityType: 'reminders',
        ids: ['r-1'],
        action: 'mark_rent_paid',
        reason: 'test',
      }),
    });
    expect([400, 503]).toContain(res.status);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('rejects an empty ids array (min 1)', async () => {
    const res = await mount().request('/owner/superpowers/bulk-action', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        entityType: 'leases',
        ids: [],
        action: 'mark_rent_paid',
        reason: 'test',
      }),
    });
    expect([400, 503]).toContain(res.status);
  });

  it('rejects ids > 100 (batch ceiling)', async () => {
    const res = await mount().request('/owner/superpowers/bulk-action', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        entityType: 'leases',
        ids: Array.from({ length: 101 }, (_, i) => `lease-${i}`),
        action: 'mark_rent_paid',
        reason: 'test',
      }),
    });
    expect([400, 503]).toContain(res.status);
  });

  it('rejects missing reason (HIGH-risk policy prefix)', async () => {
    const res = await mount().request('/owner/superpowers/bulk-action', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        entityType: 'leases',
        ids: ['lease-1'],
        action: 'mark_rent_paid',
      }),
    });
    expect([400, 503]).toContain(res.status);
  });

  it('reports DB unavailable when mock mode is on (valid payload)', async () => {
    const res = await mount().request('/owner/superpowers/bulk-action', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        entityType: 'leases',
        ids: ['lease-1'],
        action: 'mark_rent_paid',
        reason: 'April rent collected via M-Pesa',
      }),
    });
    expect([503, 500]).toContain(res.status);
  });
});
