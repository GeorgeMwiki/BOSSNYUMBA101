/**
 * parcel-service composition root — the standalone-pod boot contract.
 *
 * These guard the R2 mode-c deployment-blocker fix: the prod pod previously
 * called the bare `buildApp()` with no tenant resolver and crash-looped on the
 * tenant-spoof guard. `buildProductionApp` now wires a JWT resolver or fails
 * fast with an actionable message. The resolver tests also guard the RBAC
 * hardening: tenant id is read ONLY from the server-controlled `app_metadata`
 * (or the signed top-level claim), NEVER from client-writable `user_metadata`.
 */
import { SignJWT } from 'jose';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildProductionApp,
  createJwtTenantResolver,
} from '../build-app.js';

const SECRET = 'test-jwt-secret-at-least-ten-chars-long';
const KEY = new TextEncoder().encode(SECRET);

/** Sign an HS256 token with the given claim payload. */
async function sign(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(KEY);
}

/** Minimal Fastify-request shape the resolver reads (the Authorization header). */
function req(token?: string): unknown {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} };
}

describe('createJwtTenantResolver', () => {
  it('resolves the tenant id from a verified app_metadata.tenant_id', async () => {
    const resolver = createJwtTenantResolver(SECRET);
    const token = await sign({ app_metadata: { tenant_id: 'tenant-A' } });
    expect(await resolver.resolve(req(token))).toBe('tenant-A');
  });

  it('resolves the tenant id from the signed top-level tenantId claim', async () => {
    const resolver = createJwtTenantResolver(SECRET);
    const token = await sign({ tenantId: 'tenant-T' });
    expect(await resolver.resolve(req(token))).toBe('tenant-T');
  });

  it('REFUSES a tenant id that lives only in client-writable user_metadata', async () => {
    // user_metadata is writable via supabase.auth.updateUser — trusting it
    // would let a half-provisioned account self-select a tenant. Must be null.
    const resolver = createJwtTenantResolver(SECRET);
    const token = await sign({ user_metadata: { tenant_id: 'attacker-tenant' } });
    expect(await resolver.resolve(req(token))).toBeNull();
  });

  it('prefers app_metadata over a conflicting user_metadata tenant_id', async () => {
    const resolver = createJwtTenantResolver(SECRET);
    const token = await sign({
      app_metadata: { tenant_id: 'real-tenant' },
      user_metadata: { tenant_id: 'attacker-tenant' },
    });
    expect(await resolver.resolve(req(token))).toBe('real-tenant');
  });

  it('returns null for a bad signature (token signed with a different key)', async () => {
    const resolver = createJwtTenantResolver(SECRET);
    const wrong = new TextEncoder().encode('a-totally-different-secret-value');
    const token = await new SignJWT({ app_metadata: { tenant_id: 'tenant-A' } })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(wrong);
    expect(await resolver.resolve(req(token))).toBeNull();
  });

  it('returns null when no Bearer token is present', async () => {
    const resolver = createJwtTenantResolver(SECRET);
    expect(await resolver.resolve(req())).toBeNull();
  });

  it('returns null when the verified token carries no tenant claim at all', async () => {
    const resolver = createJwtTenantResolver(SECRET);
    const token = await sign({ sub: 'user-1' });
    expect(await resolver.resolve(req(token))).toBeNull();
  });
});

describe('buildProductionApp — fail-fast vs boot', () => {
  const apps: Array<{ close: () => Promise<void> }> = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((a) => a.close()));
  });

  it('THROWS an actionable error in production when no JWT secret is configured', async () => {
    await expect(
      buildProductionApp({ isProduction: true, jwtSecret: '' }),
    ).rejects.toThrow(/refusing to start in production without a JWT secret/i);
  });

  it('THROWS when the configured secret is too short to be real protection', async () => {
    await expect(
      buildProductionApp({ isProduction: true, jwtSecret: 'short' }),
    ).rejects.toThrow(/JWT secret/i);
  });

  it('boots a Fastify instance in production when a valid JWT secret is present', async () => {
    const app = await buildProductionApp({ isProduction: true, jwtSecret: SECRET });
    apps.push(app);
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'parcel-service' });
  });

  it('boots in dev (no secret) via the explicit header fallback', async () => {
    const app = await buildProductionApp({ isProduction: false, jwtSecret: '' });
    apps.push(app);
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });

  it('uses an injected resolver verbatim (test seam), bypassing env', async () => {
    const app = await buildProductionApp({
      isProduction: true,
      tenantResolver: { async resolve() { return 'injected-tenant'; } },
    });
    apps.push(app);
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });
});
