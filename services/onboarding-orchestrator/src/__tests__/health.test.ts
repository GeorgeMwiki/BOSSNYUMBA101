/**
 * /healthz + /readyz + /metrics endpoint tests for the
 * onboarding-orchestrator service.
 *
 * Mirrors the outcomes-metering coverage:
 *   - Memory mode: /readyz 200 instantly.
 *   - DB mode success: /readyz issues SELECT 1 and returns 200.
 *   - DB mode failure: /readyz returns 503 with reason.
 *   - DB mode timeout: /readyz returns 503 when the ping hangs.
 *   - /metrics emits the Prometheus exposition with HTTP metrics.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../index.js';
import type { ReadinessDbPool } from '../routes/readyz.js';

describe('onboarding-orchestrator /healthz', () => {
  it('returns 200 ok', async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      service: 'onboarding-orchestrator',
    });
  });
});

describe('onboarding-orchestrator /readyz', () => {
  it('returns 200 with mode=memory when no dbPool wired', async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ready: true,
      service: 'onboarding-orchestrator',
      mode: 'memory',
    });
  });

  it('returns 200 with mode=db when dbPool SELECT 1 resolves', async () => {
    const querySpy = vi.fn(async () => ({ rows: [{ '?column?': 1 }] }));
    const dbPool: ReadinessDbPool = { query: querySpy };
    const { app } = await buildApp({ dbPool });
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ready: true,
      service: 'onboarding-orchestrator',
      mode: 'db',
    });
    expect(querySpy).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns 503 with reason when dbPool SELECT 1 rejects', async () => {
    const dbPool: ReadinessDbPool = {
      query: vi.fn(async () => {
        throw new Error('connection refused');
      }),
    };
    const { app } = await buildApp({ dbPool });
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
    const body = res.json() as { ready: boolean; reason: string };
    expect(body.ready).toBe(false);
    expect(body.reason).toContain('connection refused');
  });

  it('returns 503 when the dbPool query hangs past the probe timeout', async () => {
    const dbPool: ReadinessDbPool = {
      query: () => new Promise(() => {}),
    };
    const { app } = await buildApp({ dbPool });
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
    const body = res.json() as { reason: string };
    expect(body.reason).toContain('timeout');
  }, 5_000);
});

describe('onboarding-orchestrator /metrics', () => {
  it('returns Prometheus exposition with http metrics after a request', async () => {
    const { app } = await buildApp();
    await app.inject({ method: 'GET', url: '/healthz' });
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    const body = res.body;
    expect(body).toContain('http_request_duration_seconds');
    expect(body).toContain('http_requests_total');
    expect(body).toContain('service="onboarding-orchestrator"');
  });
});
