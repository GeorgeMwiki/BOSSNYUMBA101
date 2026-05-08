/**
 * Unit tests for the per-tenant token-budget middleware.
 *
 * The Hono context is hand-rolled here so we can exercise the
 * middleware without spinning up a router. We assert: passes when
 * under-budget, 429s when over, sliding-window correctness, and
 * cross-tenant isolation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  createPerTenantRateBudgetMiddleware,
  __resetSharedPerTenantRateBudgetForTests,
} from '../per-tenant-rate-budget';

function makeApp(opts: {
  hourlyTokenBudget: number;
  windowMs?: number;
  clock?: () => number;
}): {
  app: Hono;
  buckets: Map<string, unknown>;
} {
  const middleware = createPerTenantRateBudgetMiddleware({
    hourlyTokenBudget: opts.hourlyTokenBudget,
    ...(opts.windowMs !== undefined ? { windowMs: opts.windowMs } : {}),
    ...(opts.clock ? { clock: opts.clock } : {}),
  });
  const app = new Hono();
  app.use('*', async (c, next) => {
    // Stub auth — emulate the real auth middleware that puts tenantId on context
    const headerTenant = c.req.header('x-test-tenant');
    if (headerTenant) {
      c.set('auth' as never, { tenantId: headerTenant } as never);
    }
    await next();
  });
  app.use('*', middleware.handler);
  app.get('/test', (c) => c.json({ ok: true }));
  return { app, buckets: middleware.buckets as unknown as Map<string, unknown> };
}

beforeEach(() => {
  __resetSharedPerTenantRateBudgetForTests();
});

describe('per-tenant rate budget', () => {
  it('passes a request when the tenant is well under budget', async () => {
    const { app } = makeApp({ hourlyTokenBudget: 1_000_000 });
    const res = await app.request('/test', {
      headers: { 'x-test-tenant': 'tnt-a', 'content-length': '256' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('returns 429 with Retry-After when the tenant exceeds budget', async () => {
    const { app } = makeApp({ hourlyTokenBudget: 100, windowMs: 3_600_000 });
    // Each request claims content-length 4096 chars → 1024 tokens estimate.
    // First request consumes 1024 → already over the 100-token cap.
    const first = await app.request('/test', {
      headers: { 'x-test-tenant': 'tnt-b', 'content-length': '4096' },
    });
    expect(first.status).toBe(429);
    expect(first.headers.get('Retry-After')).toBeTruthy();
    const body = (await first.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('TENANT_TOKEN_BUDGET_EXCEEDED');
  });

  it('sliding window releases capacity after windowMs elapses', async () => {
    let now = 0;
    const { app } = makeApp({
      hourlyTokenBudget: 256,
      windowMs: 1_000,
      clock: () => now,
    });
    // Each request: 1024 chars → 256 tokens. Exactly fills the budget.
    const ok1 = await app.request('/test', {
      headers: { 'x-test-tenant': 'tnt-c', 'content-length': '1024' },
    });
    expect(ok1.status).toBe(200);
    // Second request immediately would push over budget
    const overBudget = await app.request('/test', {
      headers: { 'x-test-tenant': 'tnt-c', 'content-length': '1024' },
    });
    expect(overBudget.status).toBe(429);
    // Advance the clock past the window — the prior sample expires
    now += 1_500;
    const ok2 = await app.request('/test', {
      headers: { 'x-test-tenant': 'tnt-c', 'content-length': '1024' },
    });
    expect(ok2.status).toBe(200);
  });

  it('separate tenants do not share budget', async () => {
    const { app } = makeApp({ hourlyTokenBudget: 256, windowMs: 60_000 });
    // Tenant A burns its budget
    const a1 = await app.request('/test', {
      headers: { 'x-test-tenant': 'tnt-A', 'content-length': '1024' },
    });
    expect(a1.status).toBe(200);
    const a2 = await app.request('/test', {
      headers: { 'x-test-tenant': 'tnt-A', 'content-length': '1024' },
    });
    expect(a2.status).toBe(429);
    // Tenant B is unaffected
    const b1 = await app.request('/test', {
      headers: { 'x-test-tenant': 'tnt-B', 'content-length': '1024' },
    });
    expect(b1.status).toBe(200);
  });

  it('skips the gate for unauthenticated requests', async () => {
    const { app } = makeApp({ hourlyTokenBudget: 1 }); // tiny budget
    const res = await app.request('/test', {
      headers: { 'content-length': '4096' },
    });
    // No tenantId → middleware no-ops, request passes through
    expect(res.status).toBe(200);
  });
});
