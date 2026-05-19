/**
 * Regression test for B4 C1 — /api/v1/health/deep admin gate must be
 * JWT-anchored, never trust the X-User-Role header.
 *
 * Mirrors the production wiring of `requireAdmin` in `src/index.ts`:
 * extracts the bearer token, runs `verifyJwt`, then checks the verified
 * `role` claim.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { createDeepHealthHandler } from '../deep-health';
import { extractBearerToken, verifyJwt } from '../../middleware/auth-core';
import { isPlatformAdmin, isTenantAdmin } from '../../types/user-role';

// 32+ chars so getJwtSecret() accepts it.
const TEST_SECRET = 'test-secret-must-be-32-chars-or-more-aaa';

function buildAdminGate() {
  return (req: { header: (h: string) => string | undefined }) => {
    const token = extractBearerToken(
      req.header('authorization') ?? req.header('Authorization'),
    );
    const result = verifyJwt(token);
    if (!result.ok) return false;
    const role = result.payload.role;
    return isPlatformAdmin(role) || isTenantAdmin(role);
  };
}

function mockReq(headers: Record<string, string>) {
  return {
    header: (h: string) => headers[h.toLowerCase()] ?? headers[h],
  };
}

function mockRes() {
  let code = 0;
  let body: unknown;
  const res = {
    status(c: number) {
      code = c;
      return res;
    },
    json(b: unknown) {
      body = b;
      return res;
    },
    setHeader() {
      return res;
    },
    get code() {
      return code;
    },
    get body() {
      return body;
    },
  };
  return res;
}

describe('B4 C1 — /health/deep admin gate (JWT-anchored)', () => {
  const prevSecret = process.env.JWT_SECRET;
  const prevEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env.JWT_SECRET = prevSecret;
    process.env.NODE_ENV = prevEnv;
  });

  it('rejects anonymous request — no Authorization header', async () => {
    const handler = createDeepHealthHandler({
      version: 'test',
      probes: [],
      requireAdmin: buildAdminGate(),
    });
    const res = mockRes();
    await handler(
      mockReq({}) as unknown as Parameters<typeof handler>[0],
      res as unknown as Parameters<typeof handler>[1],
    );
    expect(res.code).toBe(403);
  });

  it('rejects request with spoofed X-User-Role header but no JWT', async () => {
    const handler = createDeepHealthHandler({
      version: 'test',
      probes: [],
      requireAdmin: buildAdminGate(),
    });
    const res = mockRes();
    await handler(
      mockReq({
        'x-user-role': 'TENANT_ADMIN',
        'X-User-Role': 'TENANT_ADMIN',
      }) as unknown as Parameters<typeof handler>[0],
      res as unknown as Parameters<typeof handler>[1],
    );
    expect(res.code).toBe(403);
  });

  it('rejects request with X-User-Role spoof in development env (no JWT)', async () => {
    process.env.NODE_ENV = 'development';
    const handler = createDeepHealthHandler({
      version: 'test',
      probes: [],
      requireAdmin: buildAdminGate(),
    });
    const res = mockRes();
    await handler(
      mockReq({
        'x-user-role': 'TENANT_ADMIN',
      }) as unknown as Parameters<typeof handler>[0],
      res as unknown as Parameters<typeof handler>[1],
    );
    // Pre-fix behaviour: this would have returned 200 because NODE_ENV !== 'production'.
    expect(res.code).toBe(403);
  });

  it('rejects request with malformed Bearer token', async () => {
    const handler = createDeepHealthHandler({
      version: 'test',
      probes: [],
      requireAdmin: buildAdminGate(),
    });
    const res = mockRes();
    await handler(
      mockReq({ authorization: 'Bearer not-a-real-jwt' }) as unknown as Parameters<
        typeof handler
      >[0],
      res as unknown as Parameters<typeof handler>[1],
    );
    expect(res.code).toBe(403);
  });

  it('rejects valid JWT with non-admin role', async () => {
    const token = jwt.sign(
      {
        userId: 'u1',
        tenantId: 't1',
        role: 'RESIDENT',
        permissions: [],
        propertyAccess: [],
      },
      TEST_SECRET,
      { algorithm: 'HS256', expiresIn: '5m' },
    );
    const handler = createDeepHealthHandler({
      version: 'test',
      probes: [],
      requireAdmin: buildAdminGate(),
    });
    const res = mockRes();
    await handler(
      mockReq({ authorization: `Bearer ${token}` }) as unknown as Parameters<
        typeof handler
      >[0],
      res as unknown as Parameters<typeof handler>[1],
    );
    expect(res.code).toBe(403);
  });

  it('admits valid JWT with TENANT_ADMIN role', async () => {
    const token = jwt.sign(
      {
        userId: 'u1',
        tenantId: 't1',
        role: 'TENANT_ADMIN',
        permissions: [],
        propertyAccess: [],
      },
      TEST_SECRET,
      { algorithm: 'HS256', expiresIn: '5m' },
    );
    const handler = createDeepHealthHandler({
      version: 'test',
      probes: [],
      requireAdmin: buildAdminGate(),
    });
    const res = mockRes();
    await handler(
      mockReq({ authorization: `Bearer ${token}` }) as unknown as Parameters<
        typeof handler
      >[0],
      res as unknown as Parameters<typeof handler>[1],
    );
    expect(res.code).toBe(200);
  });

  it('admits valid JWT with SUPER_ADMIN (platform-admin) role', async () => {
    const token = jwt.sign(
      {
        userId: 'u1',
        tenantId: 't1',
        role: 'SUPER_ADMIN',
        permissions: [],
        propertyAccess: [],
      },
      TEST_SECRET,
      { algorithm: 'HS256', expiresIn: '5m' },
    );
    const handler = createDeepHealthHandler({
      version: 'test',
      probes: [],
      requireAdmin: buildAdminGate(),
    });
    const res = mockRes();
    await handler(
      mockReq({ authorization: `Bearer ${token}` }) as unknown as Parameters<
        typeof handler
      >[0],
      res as unknown as Parameters<typeof handler>[1],
    );
    expect(res.code).toBe(200);
  });
});
