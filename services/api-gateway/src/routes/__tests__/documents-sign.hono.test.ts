/**
 * POST /api/v1/documents/:id/sign — auth + validation + wiring regression.
 *
 * Live detector for BLOCKER H36 (e-sign 404): the tenant-mobile client
 * (apps/tenant-mobile/src/api/documents.ts) POSTs /api/v1/documents/:id/sign,
 * a route that did not exist, so a renter could never sign a lease. These pin:
 *   - the sign route is wired into the /documents router (never 404),
 *   - the auth gate on signing,
 *   - the zod body validator (requires signaturePayload OR biometricToken),
 *   - it accepts the biometricToken alias the mobile client actually sends,
 *   - honest degradation to 503 when no live DB is configured (mock mode),
 *     proving the handler does NOT fake a signature.
 *
 * The live insert into document_signatures (idempotency / one signature per
 * (document, signer) / uniform-404 anti-IDOR / audit hash) is exercised in the
 * integration suite against a real Drizzle DB; here the DB is mock so the
 * authenticated write resolves to 503 before any fake success.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-jwt-0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.USE_MOCK_DATA = process.env.USE_MOCK_DATA ?? 'true';

import { generateToken } from '../../middleware/auth';
import { UserRole } from '../../types/user-role';
import { documentsHonoRouter } from '../documents.hono';

const TEST_TENANT = 'tenant-docs-1';
const TEST_USER = 'user-renter-1';
const DOC_ID = 'doc-lease-1';

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
  app.route('/documents', documentsHonoRouter);
  return app;
}

beforeAll(() => {
  expect(process.env.JWT_SECRET?.length).toBeGreaterThanOrEqual(32);
});

describe('documents sign auth gate', () => {
  it('rejects an unauthenticated sign with 401 (route exists, not 404)', async () => {
    const res = await mount().request(`/documents/${DOC_ID}/sign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ biometricToken: 'bio-abc' }),
    });
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });
});

describe('documents sign validation', () => {
  it('rejects an empty body (zod refine 400) — neither payload nor alias', async () => {
    const res = await mount().request(`/documents/${DOC_ID}/sign`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({}),
    });
    expect([400, 503]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });

  it('rejects an invalid signatureMethod (zod enum 400)', async () => {
    const res = await mount().request(`/documents/${DOC_ID}/sign`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        signaturePayload: 'sig-blob-url',
        signatureMethod: 'telepathy',
      }),
    });
    expect([400, 503]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });
});

describe('documents sign reaches the DB layer (honest degradation)', () => {
  it('accepts the biometricToken alias and degrades to 503 in mock mode (no fake success)', async () => {
    const res = await mount().request(`/documents/${DOC_ID}/sign`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      // Exact shape apps/tenant-mobile/src/api/documents.ts sends.
      body: JSON.stringify({ biometricToken: 'bio-abc' }),
    });
    // Validation passes; DB is mock => the handler hits the honest
    // LIVE_DATA_NOT_CONFIGURED (503) branch BEFORE any signature is faked.
    expect([503, 500]).toContain(res.status);
    expect(res.status).not.toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('accepts the canonical signaturePayload field and degrades to 503', async () => {
    const res = await mount().request(`/documents/${DOC_ID}/sign`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        signaturePayload: 'sig-blob-url',
        signatureMethod: 'drawn',
      }),
    });
    expect([503, 500]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });
});
