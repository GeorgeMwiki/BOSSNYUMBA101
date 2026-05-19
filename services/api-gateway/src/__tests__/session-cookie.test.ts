/**
 * Session-cookie helper tests (AM-1).
 *
 * Lock in the cookie attribute contract so a regression can't silently
 * downgrade SameSite, drop httpOnly, or stop emitting Secure in
 * production. Each attribute below maps to a specific attack class
 * documented in `session-cookie.ts`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import {
  setSessionCookie,
  setRefreshCookie,
  setCsrfCookie,
  clearAllAuthCookies,
  readSessionCookie,
  readCsrfCookie,
  COOKIE_TTLS,
  SESSION_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
} from '../middleware/session-cookie';

function buildAppWithSetters(): Hono {
  const app = new Hono();
  app.get('/set-session', (c) => {
    setSessionCookie(c, 'access-jwt-value');
    return c.json({ ok: true });
  });
  app.get('/set-refresh', (c) => {
    setRefreshCookie(c, 'refresh-jwt-value');
    return c.json({ ok: true });
  });
  app.get('/set-csrf', (c) => {
    setCsrfCookie(c, 'csrf-token-value');
    return c.json({ ok: true });
  });
  app.get('/clear', (c) => {
    clearAllAuthCookies(c);
    return c.json({ ok: true });
  });
  app.get('/echo-session', (c) => {
    return c.json({ token: readSessionCookie(c) ?? null });
  });
  app.get('/echo-csrf', (c) => {
    return c.json({ token: readCsrfCookie(c) ?? null });
  });
  return app;
}

describe('session-cookie helpers (AM-1)', () => {
  let originalEnv: typeof process.env;
  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    delete process.env.COOKIE_SECURE;
    delete process.env.COOKIE_DOMAIN;
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it('TTLs match documented contract — access 1h, refresh 7d, csrf 24h', () => {
    expect(COOKIE_TTLS.access).toBe(60 * 60);
    expect(COOKIE_TTLS.refresh).toBe(60 * 60 * 24 * 7);
    expect(COOKIE_TTLS.csrf).toBe(60 * 60 * 24);
  });

  it('cookie names are the documented constants', () => {
    expect(SESSION_COOKIE_NAME).toBe('bn_session');
    expect(REFRESH_COOKIE_NAME).toBe('bn_refresh');
    expect(CSRF_COOKIE_NAME).toBe('bn_csrf');
  });

  it('session cookie is httpOnly + SameSite=Lax + Path=/', async () => {
    const app = buildAppWithSetters();
    const res = await app.request('/set-session');
    const header = res.headers.get('Set-Cookie') ?? '';
    expect(header).toContain('bn_session=access-jwt-value');
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    expect(header).toMatch(/Path=\//i);
    expect(header).toMatch(/Max-Age=3600/i);
  });

  it('refresh cookie is httpOnly + SameSite=Lax with 7d TTL', async () => {
    const app = buildAppWithSetters();
    const res = await app.request('/set-refresh');
    const header = res.headers.get('Set-Cookie') ?? '';
    expect(header).toContain('bn_refresh=refresh-jwt-value');
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    // 7d = 604800
    expect(header).toMatch(/Max-Age=604800/i);
  });

  it('csrf cookie is NOT httpOnly (SPA must read it) but is SameSite=Lax', async () => {
    const app = buildAppWithSetters();
    const res = await app.request('/set-csrf');
    const header = res.headers.get('Set-Cookie') ?? '';
    expect(header).toContain('bn_csrf=csrf-token-value');
    expect(header).not.toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    expect(header).toMatch(/Max-Age=86400/i);
  });

  it('Secure flag IS set in production', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildAppWithSetters();
    const res = await app.request('/set-session');
    const header = res.headers.get('Set-Cookie') ?? '';
    expect(header).toMatch(/Secure/i);
  });

  it('Secure flag is NOT set in test environment (HTTP supertest)', async () => {
    process.env.NODE_ENV = 'test';
    const app = buildAppWithSetters();
    const res = await app.request('/set-session');
    const header = res.headers.get('Set-Cookie') ?? '';
    expect(header).not.toMatch(/Secure/i);
  });

  it('Secure flag honours COOKIE_SECURE=true override in dev', async () => {
    process.env.NODE_ENV = 'development';
    process.env.COOKIE_SECURE = 'true';
    const app = buildAppWithSetters();
    const res = await app.request('/set-session');
    const header = res.headers.get('Set-Cookie') ?? '';
    expect(header).toMatch(/Secure/i);
  });

  it('emits Domain= attribute when COOKIE_DOMAIN is set', async () => {
    process.env.COOKIE_DOMAIN = '.bossnyumba.com';
    const app = buildAppWithSetters();
    const res = await app.request('/set-session');
    const header = res.headers.get('Set-Cookie') ?? '';
    expect(header).toMatch(/Domain=\.bossnyumba\.com/i);
  });

  it('readSessionCookie returns value when present', async () => {
    const app = buildAppWithSetters();
    const res = await app.request('/echo-session', {
      headers: { Cookie: 'bn_session=test-value-123' },
    });
    const body = await res.json();
    expect(body.token).toBe('test-value-123');
  });

  it('readSessionCookie returns undefined when missing', async () => {
    const app = buildAppWithSetters();
    const res = await app.request('/echo-session');
    const body = await res.json();
    expect(body.token).toBeNull();
  });

  it('readCsrfCookie returns the bn_csrf cookie value', async () => {
    const app = buildAppWithSetters();
    const res = await app.request('/echo-csrf', {
      headers: { Cookie: 'bn_csrf=abc123' },
    });
    const body = await res.json();
    expect(body.token).toBe('abc123');
  });

  it('clearAllAuthCookies sets all three cookies to empty + Max-Age=0', async () => {
    const app = buildAppWithSetters();
    const res = await app.request('/clear');
    const headers = res.headers.getSetCookie?.() ?? [];
    // Hono deleteCookie emits a Set-Cookie for each.
    expect(headers.some((h) => /bn_session=;.*Max-Age=0/i.test(h))).toBe(true);
    expect(headers.some((h) => /bn_refresh=;.*Max-Age=0/i.test(h))).toBe(true);
    expect(headers.some((h) => /bn_csrf=;.*Max-Age=0/i.test(h))).toBe(true);
  });
});
