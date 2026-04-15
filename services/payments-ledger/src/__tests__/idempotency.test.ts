/**
 * Unit tests for the payments-ledger idempotency store.
 *
 * The InMemoryIdempotencyStore class is not individually exported — we exercise
 * it via `createIdempotencyStore()` with IDEMPOTENCY_STORE unset, which is the
 * same path production uses for dev / single-replica mode.
 *
 * Redis path is asserted only for the boot-time REDIS_URL guard so no ioredis
 * connection is ever opened in this test file.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Silence the observability logger used inside idempotency.ts so test output
// stays readable. We only care about the store behaviour here.
vi.mock('@bossnyumba/observability', () => ({
  Logger: class {
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    debug = vi.fn();
  },
}));

import { createIdempotencyStore } from '../idempotency.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.IDEMPOTENCY_STORE;
  delete process.env.REDIS_URL;
});

afterEach(() => {
  vi.useRealTimers();
  process.env = { ...ORIGINAL_ENV };
});

describe('InMemoryIdempotencyStore (via factory)', () => {
  it('set then get returns the cached value', async () => {
    const store = createIdempotencyStore();
    await store.set('k1', { status: 201, body: { id: 'p-1' } }, 60_000);
    const got = await store.get('k1');
    expect(got).toEqual({ status: 201, body: { id: 'p-1' } });
    await store.close?.();
  });

  it('get returns null for unknown keys', async () => {
    const store = createIdempotencyStore();
    await expect(store.get('missing')).resolves.toBeNull();
    await store.close?.();
  });

  it('expired entries are not returned', async () => {
    vi.useFakeTimers();
    const store = createIdempotencyStore();
    await store.set('k-expiring', { status: 200, body: { ok: true } }, 1_000);

    // Before expiry: still present.
    await expect(store.get('k-expiring')).resolves.toEqual({
      status: 200,
      body: { ok: true },
    });

    // Advance past TTL.
    vi.advanceTimersByTime(5_000);
    await expect(store.get('k-expiring')).resolves.toBeNull();
    await store.close?.();
  });

  it('later set overwrites earlier value for the same key', async () => {
    const store = createIdempotencyStore();
    await store.set('k2', { status: 200, body: { v: 1 } }, 60_000);
    await store.set('k2', { status: 200, body: { v: 2 } }, 60_000);
    await expect(store.get('k2')).resolves.toEqual({ status: 200, body: { v: 2 } });
    await store.close?.();
  });
});

describe('createIdempotencyStore factory', () => {
  it('returns the in-memory store when IDEMPOTENCY_STORE is not "redis"', async () => {
    process.env.IDEMPOTENCY_STORE = 'memory';
    const store = createIdempotencyStore();
    // The in-memory impl behaves correctly end-to-end:
    await store.set('k', { status: 202, body: { id: 'abc' } }, 10_000);
    await expect(store.get('k')).resolves.toEqual({ status: 202, body: { id: 'abc' } });
    await store.close?.();
  });

  it('throws when IDEMPOTENCY_STORE=redis but REDIS_URL is missing', () => {
    process.env.IDEMPOTENCY_STORE = 'redis';
    delete process.env.REDIS_URL;
    expect(() => createIdempotencyStore()).toThrow(/REDIS_URL/);
  });
});
