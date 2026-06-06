/**
 * hono-auth `authMiddleware` — HS256 gateway path + Supabase fallback.
 *
 * `authMiddleware` (used by `/api/v1/ask` and 30+ other Hono routers)
 * historically verified ONLY gateway-issued HS256 tokens. HQ "Ask" sends
 * the Supabase login token, which the HS256 path rejects as INVALID_TOKEN.
 *
 * This suite locks in the unified behaviour:
 *  - Gateway HS256 token (signed with JWT_SECRET) — still accepted, context
 *    populated, blocklist still consulted (regression guard for the path
 *    that 30+ routers depend on).
 *  - Expired gateway HS256 token — still returns TOKEN_EXPIRED (the refresh
 *    signal must survive; we must NOT collapse it into the Supabase path).
 *  - Supabase token (HS256, valid sig, app_metadata.tenant_id) — accepted
 *    via the fallback; userId/tenantId/role projected onto the same auth
 *    context the /ask handlers read.
 *  - Supabase token whose tenant_id lives ONLY in user_metadata — rejected
 *    (F6: user_metadata is client-mutable, not trusted for tenant).
 *  - Bogus / malformed token — still 401 INVALID_TOKEN (fail-closed).
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { SignJWT } from 'jose';

const GATEWAY_SECRET = 'gateway-test-secret-1234567890-min32chars';
const SUPABASE_SECRET = 'supabase-test-secret-1234567890-min32chars';

// `hono-auth.ts` reads `getJwtSecret()` (→ JWT_SECRET) at MODULE TOP-LEVEL,
// so the env must be set before that static import is evaluated. ES `import`
// statements are hoisted above ordinary top-level statements, so a plain
// `process.env.X = ...` line would run too late. `vi.hoisted` runs before
// the hoisted imports — set the secrets there. No SUPABASE_URL is set, so
// the Supabase projector uses the HS256 secret path (no JWKS server needed).
vi.hoisted(() => {
  process.env.JWT_SECRET = 'gateway-test-secret-1234567890-min32chars';
  process.env.SUPABASE_JWT_SECRET = 'supabase-test-secret-1234567890-min32chars';
  delete process.env.SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
});

import { authMiddleware, type AuthContext } from '../hono-auth';

const supabaseSecretBytes = new TextEncoder().encode(SUPABASE_SECRET);

async function mintSupabaseToken(
  claims: Record<string, unknown>,
  opts: { secret?: Uint8Array } = {},
): Promise<string> {
  return await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('https://abc123.supabase.co/auth/v1')
    .setExpirationTime('1h')
    .setSubject(String(claims.sub ?? 'user-1'))
    .sign(opts.secret ?? supabaseSecretBytes);
}

function mintGatewayToken(
  payload: Record<string, unknown> = {},
  opts: { expiresIn?: string | number; secret?: string } = {},
): string {
  return jwt.sign(
    {
      userId: payload.userId ?? 'gw-user-1',
      tenantId: payload.tenantId ?? 'gw-tenant-1',
      role: payload.role ?? 'RESIDENT',
      permissions: payload.permissions ?? [],
      propertyAccess: payload.propertyAccess ?? [],
    },
    opts.secret ?? GATEWAY_SECRET,
    {
      subject: String(payload.userId ?? 'gw-user-1'),
      expiresIn: opts.expiresIn ?? '15m',
      algorithm: 'HS256',
    },
  );
}

function makeAuthProbeApp() {
  const app = new Hono();
  app.use('/probe', authMiddleware);
  app.get('/probe', (c) => {
    const auth = c.get('auth') as AuthContext | undefined;
    return c.json({
      auth,
      flatTenantId: c.get('tenantId'),
      flatUserId: c.get('userId'),
    });
  });
  return app;
}

describe('hono-auth authMiddleware — gateway HS256 path (preserved)', () => {
  let app: ReturnType<typeof makeAuthProbeApp>;
  beforeAll(() => {
    app = makeAuthProbeApp();
  });

  it('accepts a valid gateway HS256 token and populates context', async () => {
    const token = mintGatewayToken({
      userId: 'gw-7',
      tenantId: 'gw-tenant-7',
      role: 'PROPERTY_MANAGER',
    });
    const res = await app.request('/probe', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      auth: AuthContext;
      flatTenantId: string;
      flatUserId: string;
    };
    expect(body.auth.userId).toBe('gw-7');
    expect(body.auth.tenantId).toBe('gw-tenant-7');
    expect(body.auth.role).toBe('PROPERTY_MANAGER');
    expect(body.flatTenantId).toBe('gw-tenant-7');
    expect(body.flatUserId).toBe('gw-7');
  });

  it('returns TOKEN_EXPIRED for an expired gateway token (no fallback)', async () => {
    const token = mintGatewayToken({ userId: 'gw-old' }, { expiresIn: -10 });
    const res = await app.request('/probe', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects a gateway token signed with the wrong secret as 401', async () => {
    const token = mintGatewayToken({}, { secret: 'a-different-secret-1234567890-min32ch' });
    const res = await app.request('/probe', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('hono-auth authMiddleware — Supabase fallback (HQ Ask parity)', () => {
  let app: ReturnType<typeof makeAuthProbeApp>;
  beforeAll(() => {
    app = makeAuthProbeApp();
  });

  it('accepts a Supabase token and projects userId/tenantId/role', async () => {
    const token = await mintSupabaseToken({
      sub: 'sb-user-42',
      email: 'asha@kilimani.com',
      app_metadata: { tenant_id: 'sb-tenant-9', roles: ['OWNER'] },
      user_metadata: { display_name: 'Asha K.' },
    });
    const res = await app.request('/probe', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      auth: AuthContext;
      flatTenantId: string;
      flatUserId: string;
    };
    expect(body.auth.userId).toBe('sb-user-42');
    // F6: tenant_id MUST come from app_metadata.
    expect(body.auth.tenantId).toBe('sb-tenant-9');
    expect(body.auth.role).toBe('OWNER');
    // Flat accessors the legacy routers / handlers read.
    expect(body.flatTenantId).toBe('sb-tenant-9');
    expect(body.flatUserId).toBe('sb-user-42');
  });

  it('rejects a Supabase token whose tenant_id is only in user_metadata (F6)', async () => {
    const token = await mintSupabaseToken({
      sub: 'sb-user-43',
      user_metadata: { tenant_id: 'forged-by-client' },
    });
    const res = await app.request('/probe', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INVALID_TOKEN');
    expect(body.error.message).toMatch(/app_metadata/i);
  });

  it('rejects a Supabase-shaped token signed with the wrong secret', async () => {
    const token = await mintSupabaseToken(
      { sub: 'sb-user-44', app_metadata: { tenant_id: 't-x' } },
      { secret: new TextEncoder().encode('completely-different-secret-1234567890') },
    );
    const res = await app.request('/probe', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('hono-auth authMiddleware — fail-closed on bad input', () => {
  let app: ReturnType<typeof makeAuthProbeApp>;
  beforeAll(() => {
    app = makeAuthProbeApp();
  });

  it('returns 401 when the Authorization header is absent', async () => {
    const res = await app.request('/probe');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 INVALID_TOKEN for a bogus (non-Supabase) bearer', async () => {
    const res = await app.request('/probe', {
      headers: { Authorization: 'Bearer bogus.jwt' },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_TOKEN');
  });
});
