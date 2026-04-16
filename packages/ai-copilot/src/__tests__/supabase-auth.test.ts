/**
 * Supabase JWT verification tests.
 *
 * These tests use jose to mint a real HS256 JWT with a known secret, verify
 * it through `verifySupabaseJwt`, and assert the projected principal +
 * Brain contexts. No fakes — actual cryptographic verify path.
 */

import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import {
  verifySupabaseJwt,
  extractBearer,
  principalToBrainContexts,
  SupabaseAuthError,
  loadBrainEnv,
  tryLoadBrainEnv,
  BrainConfigError,
} from '../config/index.js';

const SECRET = 'test-secret-for-jwt-verification-1234567890';
const enc = new TextEncoder().encode(SECRET);

async function mintToken(claims: Record<string, unknown>) {
  return await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .setSubject(String(claims.sub ?? 'user-1'))
    .sign(enc);
}

describe('extractBearer', () => {
  it('extracts a Bearer token from a header value', () => {
    expect(extractBearer('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });
  it('returns null for missing or malformed', () => {
    expect(extractBearer(null)).toBeNull();
    expect(extractBearer('Basic xyz')).toBeNull();
    expect(extractBearer('')).toBeNull();
  });
});

describe('verifySupabaseJwt', () => {
  it('verifies a well-formed token with app_metadata.tenant_id', async () => {
    const token = await mintToken({
      sub: 'user-42',
      email: 'asha@kilimani.com',
      app_metadata: {
        tenant_id: 'tenant-1',
        tenant_name: 'Kilimani Heights',
        roles: ['admin', 'manager'],
        team_ids: ['leasing-1'],
        environment: 'production',
      },
    });
    const principal = await verifySupabaseJwt(token, { jwtSecret: SECRET });
    expect(principal.userId).toBe('user-42');
    expect(principal.tenantId).toBe('tenant-1');
    expect(principal.tenantName).toBe('Kilimani Heights');
    expect(principal.roles).toEqual(['admin', 'manager']);
    expect(principal.teamIds).toEqual(['leasing-1']);
    expect(principal.environment).toBe('production');
  });

  it('app_metadata overrides user_metadata for tenant assignment', async () => {
    const token = await mintToken({
      sub: 'user-7',
      user_metadata: { tenant_id: 'wrong-tenant', roles: ['employee'] },
      app_metadata: { tenant_id: 'right-tenant', roles: ['admin'] },
    });
    const p = await verifySupabaseJwt(token, { jwtSecret: SECRET });
    expect(p.tenantId).toBe('right-tenant');
    expect(p.roles).toEqual(['admin']);
  });

  it('rejects with 403 when no tenant claim is present', async () => {
    const token = await mintToken({ sub: 'user-x' });
    await expect(
      verifySupabaseJwt(token, { jwtSecret: SECRET })
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects with 401 on bad signature', async () => {
    const token = await mintToken({
      sub: 'user-9',
      app_metadata: { tenant_id: 't1' },
    });
    await expect(
      verifySupabaseJwt(token, { jwtSecret: 'wrong-secret-dont-match' })
    ).rejects.toThrow(SupabaseAuthError);
  });

  it('rejects with 401 on missing token', async () => {
    await expect(
      verifySupabaseJwt('', { jwtSecret: SECRET })
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('principalToBrainContexts', () => {
  it('marks admin and computes management flag', async () => {
    const token = await mintToken({
      sub: 'u1',
      app_metadata: { tenant_id: 't1', roles: ['admin'] },
    });
    const p = await verifySupabaseJwt(token, { jwtSecret: SECRET });
    const ctx = principalToBrainContexts(p);
    expect(ctx.viewer.isAdmin).toBe(true);
    expect(ctx.viewer.isManagement).toBe(true);
  });
  it('marks team_leader as management without admin', async () => {
    const token = await mintToken({
      sub: 'u2',
      app_metadata: { tenant_id: 't1', roles: ['team_leader'] },
    });
    const p = await verifySupabaseJwt(token, { jwtSecret: SECRET });
    const ctx = principalToBrainContexts(p);
    expect(ctx.viewer.isAdmin).toBe(false);
    expect(ctx.viewer.isManagement).toBe(true);
  });
  it('plain employee is neither admin nor management', async () => {
    const token = await mintToken({
      sub: 'u3',
      app_metadata: { tenant_id: 't1', roles: ['employee'] },
    });
    const p = await verifySupabaseJwt(token, { jwtSecret: SECRET });
    const ctx = principalToBrainContexts(p);
    expect(ctx.viewer.isAdmin).toBe(false);
    expect(ctx.viewer.isManagement).toBe(false);
  });
});

describe('Brain env loader', () => {
  it('throws BrainConfigError when required env is missing', () => {
    expect(() => loadBrainEnv({})).toThrow(BrainConfigError);
  });

  it('tryLoadBrainEnv returns null when env is missing', () => {
    expect(tryLoadBrainEnv({})).toBeNull();
  });

  it('passes when all required env is present', () => {
    const ok = loadBrainEnv({
      ANTHROPIC_API_KEY: 'sk-ant-test-12345',
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key-12345',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-12345',
      SUPABASE_JWT_SECRET: 'jwt-secret-1234567890',
      DATABASE_URL: 'postgresql://x:y@host:5432/db',
    } as unknown as NodeJS.ProcessEnv);
    expect(ok.ANTHROPIC_API_KEY).toBe('sk-ant-test-12345');
  });
});
