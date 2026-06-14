/**
 * Composition-root tests (Wave-B money finding #7 — BORN-DARK +
 * FAKE-PERSISTENCE).
 *
 * `buildProductionApp` is the composition root the process entrypoint
 * calls. These tests pin:
 *
 *   1. With an injected Drizzle client, it wires the REAL Drizzle store
 *      + DB-backed readiness + a bus consumer (NOT born-dark): the
 *      consumer subscribes and `/readyz` reports mode=db.
 *   2. PRODUCTION FAIL-FAST: when prod adapters are required but no db
 *      resolves, it THROWS rather than silently running the volatile
 *      in-memory store.
 *   3. DEV fallback: when prod adapters are NOT required and no db
 *      resolves, it still wires a bus consumer over the in-memory store
 *      (so the service is not born-dark even in dev), and `/readyz`
 *      serves ready in memory mode.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildProductionApp } from '../composition/build-app.js';
import type { DrizzleBillingClient, DrizzleTxLike } from '../store/drizzle-billing-store.js';

/** Minimal fake Drizzle client — answers SELECT 1 + transactions. */
function fakeDb(): DrizzleBillingClient {
  const run = async (): Promise<unknown> => ({ rows: [{ '?column?': 1 }] });
  return {
    execute: () => run(),
    async transaction<T>(fn: (tx: DrizzleTxLike) => Promise<T>): Promise<T> {
      return fn({ execute: () => run() });
    },
  };
}

describe('buildProductionApp', () => {
  it('wires the Drizzle store, DB-backed readiness, and a bus consumer when a db is injected', async () => {
    const { app, consumer, store } = await buildProductionApp({
      db: fakeDb(),
      requireProdAdapters: true,
    });
    expect(store).toBeDefined();
    // Consumer is wired (NOT born-dark) — it subscribed to all three types.
    expect(consumer).not.toBeNull();
    expect(consumer?.subscriptions.length).toBe(3);

    // /readyz pings the live DB.
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ready: true, mode: 'db' });
  });

  it('FAILS FAST: throws when prod adapters are required but no db resolves', async () => {
    await expect(
      buildProductionApp({ db: null, requireProdAdapters: true }),
    ).rejects.toThrow(/production adapters are required/i);
  });

  it('DEV fallback: wires a bus consumer over the in-memory store when prod adapters are not required', async () => {
    const { app, consumer, store } = await buildProductionApp({
      db: null,
      requireProdAdapters: false,
    });
    expect(store).toBeDefined();
    // Not born-dark even in dev — a process-local bus is wired.
    expect(consumer).not.toBeNull();
    expect(consumer?.subscriptions.length).toBe(3);

    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ready: true, mode: 'memory' });
  });

  it('accepts an injected shared bus so the consumer rides the api-gateway bus', async () => {
    const subscribe = vi.fn(() => ({ id: 'sub_1', type: 't', unsubscribe: vi.fn() }));
    const sharedBus = { subscribe };
    const { consumer } = await buildProductionApp({
      db: fakeDb(),
      bus: sharedBus,
      requireProdAdapters: true,
    });
    expect(consumer).not.toBeNull();
    // The injected bus received the three subscriptions.
    expect(subscribe).toHaveBeenCalledTimes(3);
  });
});
