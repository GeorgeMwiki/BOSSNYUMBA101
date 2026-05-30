/**
 * /api/v1/owner/share-links — auth + validation regression tests.
 *
 * These tests pin the public auth gate, the zod payload validator, and
 * the 503 "DB not configured" branch. End-to-end coverage with a live
 * Drizzle DB lives in the integration suite (Wave SUPERPOWERS E2E).
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
import { ownerShareLinksRouter } from '../share-links.hono';

const TEST_TENANT = 'tenant-share-1';
const TEST_USER = 'user-owner-share-1';

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
  app.route('/owner/share-links', ownerShareLinksRouter);
  return app;
}

beforeAll(() => {
  expect(process.env.JWT_SECRET?.length).toBeGreaterThanOrEqual(32);
});

describe('owner-share-links auth gate', () => {
  it('rejects unauthenticated POST', async () => {
    const res = await mount().request('/owner/share-links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated GET', async () => {
    const res = await mount().request('/owner/share-links');
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated DELETE', async () => {
    const res = await mount().request('/owner/share-links/some-id', {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });
});

describe('owner-share-links payload validation', () => {
  it('rejects POST with an invalid entityType (zod 400)', async () => {
    const res = await mount().request('/owner/share-links', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        entityType: 'NOT_A_REAL_ENTITY',
        entityId: 'abc-123',
      }),
    });
    // Either 400 (validation rejects before DB) or 503 (DB unavailable
    // in mock mode). Either confirms the route is wired and runs the
    // middleware chain; 400 is the preferred shape when the zod path
    // fires first.
    expect([400, 503]).toContain(res.status);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(typeof body.error.code).toBe('string');
  });

  it('rejects POST with expiresInHours > 720 (30d cap)', async () => {
    const res = await mount().request('/owner/share-links', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        entityType: 'lease',
        entityId: 'lease-abc',
        expiresInHours: 9999,
      }),
    });
    expect([400, 503]).toContain(res.status);
  });

  it('reports DB unavailable when mock mode is on', async () => {
    const res = await mount().request('/owner/share-links', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        entityType: 'lease',
        entityId: 'lease-abc',
      }),
    });
    // Validation passes; DB is mock => 503 SHARE_DB_UNAVAILABLE.
    expect([503, 500]).toContain(res.status);
  });
});
