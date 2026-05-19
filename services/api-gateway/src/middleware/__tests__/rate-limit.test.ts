/**
 * Unit tests for the per-route `withRateLimit` Hono middleware.
 *
 * Asserts: returns 200 under cap, 429 on overflow, per-tenant
 * isolation, per-method isolation, IP fallback for anonymous calls.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { withRateLimit, __resetRateLimitStoreForTests } from '../rate-limit';

function makeApp(opts: {
  key: string;
  max: number;
  windowMs?: number;
  clock?: () => number;
}): Hono {
  const app = new Hono();
  app.use('*', async (c, next) => {
    const headerTenant = c.req.header('x-test-tenant');
    if (headerTenant) {
      c.set('auth' as never, { tenantId: headerTenant } as never);
    }
    await next();
  });
  app.use(
    '*',
    withRateLimit({
      key: opts.key,
      max: opts.max,
      window: opts.windowMs ?? 60_000,
      ...(opts.clock ? { clock: opts.clock } : {}),
    }),
  );
  app.get('/ping', (c) => c.json({ ok: true }));
  app.post('/ping', (c) => c.json({ ok: 'post' }));
  return app;
}

beforeEach(() => {
  __resetRateLimitStoreForTests();
});

describe('withRateLimit', () => {
  it('passes requests while under the cap', async () => {
    const app = makeApp({ key: 'k1', max: 3 });
    for (let i = 0; i < 3; i++) {
      const res = await app.request('/ping', {
        method: 'GET',
        headers: { 'x-test-tenant': 'tenant-a' },
      });
      expect(res.status).toBe(200);
    }
  });

  it('returns 429 once the cap is exceeded', async () => {
    const app = makeApp({ key: 'k1', max: 2 });
    await app.request('/ping', { headers: { 'x-test-tenant': 'tenant-a' } });
    await app.request('/ping', { headers: { 'x-test-tenant': 'tenant-a' } });
    const res = await app.request('/ping', {
      headers: { 'x-test-tenant': 'tenant-a' },
    });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res.headers.get('retry-after')).toBeTruthy();
  });

  it('isolates buckets per tenant', async () => {
    const app = makeApp({ key: 'k1', max: 1 });
    const a1 = await app.request('/ping', {
      headers: { 'x-test-tenant': 'tenant-a' },
    });
    const b1 = await app.request('/ping', {
      headers: { 'x-test-tenant': 'tenant-b' },
    });
    expect(a1.status).toBe(200);
    expect(b1.status).toBe(200);
    const a2 = await app.request('/ping', {
      headers: { 'x-test-tenant': 'tenant-a' },
    });
    expect(a2.status).toBe(429);
  });

  it('isolates buckets per HTTP method', async () => {
    const app = makeApp({ key: 'k1', max: 1 });
    const g = await app.request('/ping', {
      headers: { 'x-test-tenant': 'tenant-a' },
    });
    const p = await app.request('/ping', {
      method: 'POST',
      headers: { 'x-test-tenant': 'tenant-a' },
    });
    expect(g.status).toBe(200);
    expect(p.status).toBe(200);
  });

  it('falls back to IP when tenantId is absent', async () => {
    const app = makeApp({ key: 'k1', max: 1 });
    const r1 = await app.request('/ping', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    const r2 = await app.request('/ping', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(429);
  });

  it('resets the bucket after the window elapses', async () => {
    let now = 1_000_000;
    const app = makeApp({ key: 'k1', max: 1, windowMs: 1000, clock: () => now });
    const r1 = await app.request('/ping', {
      headers: { 'x-test-tenant': 'tenant-a' },
    });
    expect(r1.status).toBe(200);
    const r2 = await app.request('/ping', {
      headers: { 'x-test-tenant': 'tenant-a' },
    });
    expect(r2.status).toBe(429);
    now += 1500;
    const r3 = await app.request('/ping', {
      headers: { 'x-test-tenant': 'tenant-a' },
    });
    expect(r3.status).toBe(200);
  });

  it('rejects empty key at construction time', () => {
    expect(() =>
      withRateLimit({ key: '', max: 1, window: 1000 }),
    ).toThrowError(/key/);
  });
});
