/**
 * Admin-portal BFF — industry KPI route tests (live detectors).
 *
 * Coverage:
 *   - GET /industry/:slot      rejects no-bearer (401)
 *   - GET /industry/:slot      rejects TENANT_ADMIN (403 — platform-HQ only)
 *   - GET /industry/:slot      rejects unknown slot (404 uniform)
 *   - GET /industry/:slot      503 when DATABASE_URL unset (no db handle),
 *                              NOT a fabricated value
 *   - GET /industry            same auth + degrade contract for the rollup
 *
 * These run against the real router so the router-level role gate, the
 * per-route `isPlatformAdmin` guard, and the zod param-validation are all
 * exercised end-to-end. The handlers call `getDb()` directly; in the test
 * env `DATABASE_URL` is unset, so a platform-admin caller hits the honest
 * 503 (the page renders a DegradedCard) rather than a stubbed zero.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-jwt-0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.BOSSNYUMBA_SKIP_DOTENV = 'true';

import { generateToken } from '../../../middleware/auth';
import { UserRole } from '../../../types/user-role';
import { adminPortalRouter } from '../admin-portal';

function bearer(role: UserRole): string {
  return `Bearer ${generateToken({
    userId: 'usr-test',
    tenantId: 'tnt-test',
    role: role as never,
    permissions: ['*'],
    propertyAccess: ['*'],
  })}`;
}

function mount(): Hono {
  const app = new Hono();
  app.route('/admin', adminPortalRouter);
  return app;
}

async function get(path: string, role?: UserRole): Promise<Response> {
  const headers: Record<string, string> = {};
  if (role) headers.Authorization = bearer(role);
  return mount().request(`/admin${path}`, { method: 'GET', headers });
}

describe('admin-portal BFF — industry KPI auth gates', () => {
  beforeAll(() => {
    expect(process.env.JWT_SECRET?.length ?? 0).toBeGreaterThanOrEqual(32);
  });

  it('rejects an unauthenticated industry slot request (401)', async () => {
    const res = await get('/industry/occupancy-by-class');
    expect(res.status).toBe(401);
  });

  it('rejects TENANT_ADMIN — industry is platform-HQ only (403)', async () => {
    const res = await get('/industry/occupancy-by-class', UserRole.TENANT_ADMIN);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('FORBIDDEN');
  });

  it('rejects the rollup for TENANT_ADMIN (403)', async () => {
    const res = await get('/industry', UserRole.TENANT_ADMIN);
    expect(res.status).toBe(403);
  });
});

describe('admin-portal BFF — industry KPI validation + degrade', () => {
  it('returns a uniform 404 for an unknown slot (no enumeration leak)', async () => {
    const res = await get('/industry/not-a-real-slot', UserRole.SUPER_ADMIN);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe('NOT_FOUND');
    // The message must NOT echo the valid-slot list back to the caller.
    expect(body.error?.message ?? '').not.toContain('occupancy-by-class');
  });

  it('degrades to 503 (not a fabricated value) when no DB is configured', async () => {
    const res = await get('/industry/vendor-reopen-rate', UserRole.ADMIN);
    // DATABASE_URL is unset in the test env → getDb() === null → honest 503.
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      success?: boolean;
      error?: { code?: string };
    };
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('rollup also degrades to 503 when no DB is configured', async () => {
    const res = await get('/industry', UserRole.SUPER_ADMIN);
    expect(res.status).toBe(503);
  });

  it('accepts every known slot key through validation (no 404)', async () => {
    const slots = [
      'arrears-by-jurisdiction',
      'occupancy-by-class',
      'vendor-reopen-rate',
      'sentiment-index',
      'renewal-rate',
      'maintenance-ttc',
    ];
    for (const slot of slots) {
      const res = await get(`/industry/${slot}`, UserRole.SUPER_ADMIN);
      // Valid slot + admin role: never a 404 (validation pass), never a
      // 401/403 (auth pass). Without a DB it's a 503; that's the honest
      // degrade, not a validation failure.
      expect([200, 503]).toContain(res.status);
    }
  });
});
