/**
 * CSRF middleware tests (AM-1).
 *
 * Validates the double-submit cookie pattern + Origin header check.
 * Every test exercises one of the documented branches in
 * `csrf.middleware.ts`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { csrfMiddleware, generateCsrfToken, __testing } from '../middleware/csrf.middleware';

function makeApp(): Hono {
  const app = new Hono();
  app.use('*', csrfMiddleware);
  app.get('/api/v1/leases', (c) => c.json({ ok: true }));
  app.post('/api/v1/leases', (c) => c.json({ ok: true }));
  app.put('/api/v1/leases/x', (c) => c.json({ ok: true }));
  app.delete('/api/v1/leases/x', (c) => c.json({ ok: true }));
  app.post('/api/v1/auth/login', (c) => c.json({ ok: true })); // exempt
  app.post('/api/v1/auth/csrf', (c) => c.json({ ok: true })); // exempt
  app.post('/api/v1/auth/refresh', (c) => c.json({ ok: true })); // exempt
  return app;
}

describe('CSRF middleware (AM-1)', () => {
  let originalEnv: typeof process.env;
  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001';
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it('allows safe methods (GET) without any CSRF check', async () => {
    const app = makeApp();
    const res = await app.request('/api/v1/leases');
    expect(res.status).toBe(200);
  });

  it('rejects POST without Origin/Referer with 403 CSRF_ORIGIN_REJECTED', async () => {
    const app = makeApp();
    const res = await app.request('/api/v1/leases', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe('CSRF_ORIGIN_REJECTED');
  });

  it('rejects POST with disallowed Origin', async () => {
    const app = makeApp();
    const res = await app.request('/api/v1/leases', {
      method: 'POST',
      body: '{}',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil.example',
      },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe('CSRF_ORIGIN_REJECTED');
  });

  it('rejects POST with valid Origin but no CSRF cookie', async () => {
    const app = makeApp();
    const res = await app.request('/api/v1/leases', {
      method: 'POST',
      body: '{}',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        'X-CSRF-Token': 'something',
      },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe('CSRF_TOKEN_MISSING');
  });

  it('rejects POST when cookie and header tokens differ', async () => {
    const app = makeApp();
    const res = await app.request('/api/v1/leases', {
      method: 'POST',
      body: '{}',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: 'bn_csrf=cookie-token-abc',
        'X-CSRF-Token': 'header-token-xyz',
      },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe('CSRF_TOKEN_MISMATCH');
  });

  it('accepts POST when cookie + header match exactly', async () => {
    const app = makeApp();
    const token = 'shared-token-value';
    const res = await app.request('/api/v1/leases', {
      method: 'POST',
      body: '{}',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: `bn_csrf=${token}`,
        'X-CSRF-Token': token,
      },
    });
    expect(res.status).toBe(200);
  });

  it('accepts PUT + DELETE on the same path with valid CSRF', async () => {
    const app = makeApp();
    const token = 'shared';
    const headers = {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      Cookie: `bn_csrf=${token}`,
      'X-CSRF-Token': token,
    };
    const put = await app.request('/api/v1/leases/x', { method: 'PUT', body: '{}', headers });
    expect(put.status).toBe(200);
    const del = await app.request('/api/v1/leases/x', { method: 'DELETE', headers });
    expect(del.status).toBe(200);
  });

  it('exempts /auth/csrf (bootstrap endpoint)', async () => {
    const app = makeApp();
    const res = await app.request('/api/v1/auth/csrf', { method: 'POST', body: '{}' });
    expect(res.status).toBe(200);
  });

  it('exempts /auth/login (no session yet — no CSRF risk)', async () => {
    const app = makeApp();
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(200);
  });

  it('exempts /auth/refresh (rotation flow)', async () => {
    const app = makeApp();
    const res = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(200);
  });

  it('exempts bearer-token requests (header auth → immune to CSRF)', async () => {
    const app = makeApp();
    const res = await app.request('/api/v1/leases', {
      method: 'POST',
      body: '{}',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer some-jwt',
      },
    });
    // No CSRF cookie set, but the Bearer header should bypass the check.
    expect(res.status).toBe(200);
  });

  it('exempts X-API-Key requests', async () => {
    const app = makeApp();
    const res = await app.request('/api/v1/leases', {
      method: 'POST',
      body: '{}',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'service-key',
      },
    });
    expect(res.status).toBe(200);
  });

  it('accepts Referer when Origin is missing', async () => {
    const app = makeApp();
    const token = 'tk';
    const res = await app.request('/api/v1/leases', {
      method: 'POST',
      body: '{}',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'http://localhost:3000/leases',
        Cookie: `bn_csrf=${token}`,
        'X-CSRF-Token': token,
      },
    });
    expect(res.status).toBe(200);
  });

  it('originAllowed test helper matches the configured whitelist', () => {
    expect(__testing.originAllowed('http://localhost:3000')).toBe(true);
    expect(__testing.originAllowed('https://evil.example')).toBe(false);
    expect(__testing.originAllowed(undefined)).toBe(false);
  });

  it('constantTimeEqual matches identical strings and rejects different lengths', () => {
    expect(__testing.constantTimeEqual('abc', 'abc')).toBe(true);
    expect(__testing.constantTimeEqual('abc', 'abcd')).toBe(false);
    expect(__testing.constantTimeEqual('abc', 'abd')).toBe(false);
  });

  it('generateCsrfToken produces a 64-char hex string (256 bits)', () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    // Tokens should not collide across invocations
    const another = generateCsrfToken();
    expect(another).not.toBe(token);
  });
});
