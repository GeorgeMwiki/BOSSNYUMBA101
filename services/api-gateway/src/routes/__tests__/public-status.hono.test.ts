/**
 * public-status router tests — GET /api/v1/public/status.
 *
 * Backs the marketing /status page (apps/marketing/src/components/
 * StatusBoard.tsx). These tests pin the PUBLIC wire contract + the honesty
 * invariants the route MUST hold:
 *
 *   PUBLIC / NO AUTH
 *     - no Authorization header → 200 (the board is unauthenticated).
 *     - response carries `Cache-Control: public, max-age=15`.
 *
 *   CONTRACT (matches StatusBoard's StatusResponse)
 *     - { success: true, data: { overall, components[6], generatedAt,
 *       windowDays } }; components are the fixed 6-name grid in order.
 *
 *   HONESTY (NO FABRICATION)
 *     - a component absent from the table is reported `unknown` (the grid is
 *       complete but never invented).
 *     - overall is the worst-of rollup (outage > degraded > ok > unknown).
 *     - a DB read failure collapses to an all-`unknown` board (still 200) so
 *       the page renders a real "status unknown" surface, not fabricated
 *       green.
 *
 * No live Postgres: a fake drizzle handle is pre-injected; databaseMiddleware
 * honours it and (because the route is unauthenticated) skips the tenant tx.
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-jwt-0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import publicStatusRouter from '../public-status.hono';

const ALL_COMPONENTS = [
  'api-gateway',
  'database',
  'auth',
  'storage',
  'workers',
  'realtime',
];

/** Fake db whose `.select(...).from(...)` is a thenable resolving to rows. */
function makeFakeDb(rows: ReadonlyArray<Record<string, unknown>>) {
  return {
    // No tenant on a public route → databaseMiddleware skips the tenant tx and
    // never calls execute; included only for parity with authed stubs.
    execute: async () => ({ rows: [] }),
    select: () => ({
      from: () => ({
        then: (resolve: (v: unknown) => unknown) => resolve(rows),
      }),
    }),
  };
}

/** Fake db whose read throws — exercises the honest-degrade path. */
function makeThrowingDb() {
  return {
    execute: async () => ({ rows: [] }),
    select: () => ({
      from: () => ({
        then: () => {
          throw new Error('db read boom');
        },
      }),
    }),
  };
}

function mount(db: unknown): Hono {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('db', db as never);
    await next();
  });
  app.route('/public/status', publicStatusRouter);
  return app;
}

describe('GET /public/status — public, cacheable', () => {
  it('serves an unauthenticated 200 with a cache header', async () => {
    const res = await mount(makeFakeDb([])).request('/public/status');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=15');
  });
});

describe('GET /public/status — contract', () => {
  it('returns the full 6-component grid in fixed order', async () => {
    const res = await mount(makeFakeDb([])).request('/public/status');
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.windowDays).toBe(90);
    expect(typeof body.data.generatedAt).toBe('string');
    expect(body.data.components.map((c: { component: string }) => c.component)).toEqual(
      ALL_COMPONENTS,
    );
  });
});

describe('GET /public/status — honesty (no fabrication)', () => {
  it('reports absent components as unknown and rolls up overall', async () => {
    // Only one component is known and it is in outage.
    const res = await mount(
      makeFakeDb([
        {
          component: 'database',
          currentStatus: 'outage',
          lastChangedAt: '2026-06-14T00:00:00.000Z',
          history: [{ date: '2026-06-13', status: 'ok' }],
          uptimePct: '99.500',
        },
      ]),
    ).request('/public/status');
    const body = await res.json();

    expect(body.data.overall).toBe('outage');
    const db = body.data.components.find(
      (c: { component: string }) => c.component === 'database',
    );
    expect(db.current).toBe('outage');
    expect(db.uptimePct).toBeCloseTo(99.5);
    expect(db.history).toEqual([{ date: '2026-06-13', status: 'ok' }]);
    // Every other component is honestly unknown.
    const auth = body.data.components.find(
      (c: { component: string }) => c.component === 'auth',
    );
    expect(auth.current).toBe('unknown');
    expect(auth.lastChangedAt).toBeNull();
  });

  it('rolls up to ok when all known components are ok', async () => {
    const res = await mount(
      makeFakeDb(
        ALL_COMPONENTS.map((component) => ({
          component,
          currentStatus: 'ok',
          lastChangedAt: null,
          history: [],
          uptimePct: '100',
        })),
      ),
    ).request('/public/status');
    const body = await res.json();
    expect(body.data.overall).toBe('ok');
  });

  it('collapses to an all-unknown board (still 200) on a DB read failure', async () => {
    const res = await mount(makeThrowingDb()).request('/public/status');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.overall).toBe('unknown');
    expect(body.data.components).toHaveLength(6);
    expect(
      body.data.components.every(
        (c: { current: string }) => c.current === 'unknown',
      ),
    ).toBe(true);
  });
});
