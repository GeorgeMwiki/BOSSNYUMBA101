/**
 * M3 — selection logic for the durable webhook idempotency store.
 *
 * Mirrors the repository factory's adapter-selection discipline:
 *   1. REDIS_URL set        → Redis (SET NX EX), shared across replicas.
 *   2. else a DB client     → Postgres unique index.
 *   3. else in production    → THROW (refuse to run with a process-local
 *                             dedup store — that's the double-credit bug
 *                             we are fixing).
 *   4. else (dev/test)       → in-memory fallback.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  selectWebhookIdempotencyStore,
  type IdempotencyStoreFactoryDeps,
} from '../lib/idempotency-store-factory';

const noopLogger = {
  warn: vi.fn(),
  info: vi.fn(),
};

function fakeRedis() {
  return {
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async () => 1),
    // MUST-FIX 2: release is now an atomic compare-and-delete via eval.
    eval: vi.fn(async () => 1),
  };
}

function fakeDb() {
  // Only the methods the Postgres store touches need to exist for the
  // selection test; we never actually execute a query here.
  return {} as unknown as IdempotencyStoreFactoryDeps['db'];
}

describe('selectWebhookIdempotencyStore (M3)', () => {
  it('uses Redis when a redis client is supplied (REDIS_URL path)', () => {
    const redis = fakeRedis();
    const { kind } = selectWebhookIdempotencyStore({
      redis,
      db: fakeDb(),
      isProduction: true,
      logger: noopLogger,
    });
    expect(kind).toBe('redis');
  });

  it('falls back to Postgres when no redis but a db client is present', () => {
    const { kind } = selectWebhookIdempotencyStore({
      redis: null,
      db: fakeDb(),
      isProduction: true,
      logger: noopLogger,
    });
    expect(kind).toBe('postgres');
  });

  it('THROWS in production when neither redis nor db is available', () => {
    expect(() =>
      selectWebhookIdempotencyStore({
        redis: null,
        db: null,
        isProduction: true,
        logger: noopLogger,
      }),
    ).toThrow(/durable idempotency store/i);
  });

  it('falls back to in-memory in dev/test when neither is available', () => {
    const { kind } = selectWebhookIdempotencyStore({
      redis: null,
      db: null,
      isProduction: false,
      logger: noopLogger,
    });
    expect(kind).toBe('in-memory');
  });
});
