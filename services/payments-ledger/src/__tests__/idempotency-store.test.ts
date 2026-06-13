/**
 * M3 (CRITICAL) — durable, tenant-scoped, crash-safe webhook idempotency.
 *
 * The old `CallbackDeduplicator` was a process-local `Map` that even
 * `.clear()`ed every 24h → a double-credit window across replicas /
 * restarts. The replacement is a durable {@link DurableIdempotencyStore}
 * (Redis `SET NX EX` when REDIS_URL is set, else a Postgres unique
 * index) behind a small reserve/release contract that satisfies:
 *
 *   - dedup: the same callback claimed twice is processed once (M3);
 *   - tenant-scoping: the key is namespaced by tenant (M7);
 *   - record-after-success: a FAILED handler releases the claim so the
 *     callback can be reprocessed — a failure must not burn the key (M8).
 *
 * These tests pin the contract against the in-memory reference
 * implementation (the Redis/Postgres adapters implement the same
 * interface and are covered by integration tests).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildWebhookIdempotencyKey,
  createInMemoryDurableIdempotencyStore,
  createRedisIdempotencyStore,
  type DurableIdempotencyStore,
  type RedisLike,
} from '../lib/idempotency-store';

describe('DurableIdempotencyStore (M3)', () => {
  let store: DurableIdempotencyStore;

  beforeEach(() => {
    store = createInMemoryDurableIdempotencyStore();
  });

  it('claims a fresh key once and reports duplicates thereafter', async () => {
    const key = buildWebhookIdempotencyKey('tnt_a', 'mpesa-stk', 'RCPT1');

    // First claim succeeds (caller processes) → returns a release token.
    expect(await store.claim(key)).toBeTruthy();
    // Second claim of the same key is a duplicate (caller skips) → null.
    expect(await store.claim(key)).toBeNull();
    expect(await store.claim(key)).toBeNull();
  });

  it('namespaces keys by tenant (M7) — same external id, different tenants do not collide', async () => {
    const keyA = buildWebhookIdempotencyKey('tnt_a', 'mpesa-c2b', 'SHARED_TX');
    const keyB = buildWebhookIdempotencyKey('tnt_b', 'mpesa-c2b', 'SHARED_TX');

    expect(await store.claim(keyA)).toBeTruthy();
    // Tenant B's identical TransID must still be claimable.
    expect(await store.claim(keyB)).toBeTruthy();
    // But each tenant's own retry is a duplicate.
    expect(await store.claim(keyA)).toBeNull();
    expect(await store.claim(keyB)).toBeNull();
  });

  it('releases the claim on failure so the callback can be reprocessed (M8)', async () => {
    const key = buildWebhookIdempotencyKey('tnt_a', 'mpesa-stk', 'RCPT2');

    // Claim, then the handler fails → release with the claim's token.
    const token = await store.claim(key);
    expect(token).toBeTruthy();
    await store.release(key, token!);

    // After release the key is free again — a retry must reprocess.
    expect(await store.claim(key)).toBeTruthy();
    // And once it succeeds (no release), further retries are duplicates.
    expect(await store.claim(key)).toBeNull();
  });

  it('release of an unknown key is a no-op (never throws)', async () => {
    await expect(
      store.release(buildWebhookIdempotencyKey('tnt_a', 'mpesa-stk', 'never_claimed'), 'tok'),
    ).resolves.toBeUndefined();
  });

  // ── MUST-FIX 2 (HIGH): release must be a COMPARE-AND-DELETE ──────────
  // release(key, token) may only remove the claim when the stored token
  // matches. Otherwise a late/transient failure of a SECOND delivery
  // (after the key TTL-expired and that delivery re-won the claim) would
  // delete the live claim and let a THIRD delivery reprocess → double SMS/
  // events / double-credit.
  it('a release with a NON-matching token does not delete a live claim', async () => {
    const key = buildWebhookIdempotencyKey('tnt_a', 'mpesa-stk', 'RCPT_CAS');

    // Delivery #1 wins the claim and gets token1.
    const token1 = await store.claim(key);
    expect(token1).toBeTruthy();

    // A stale delivery (holding a DIFFERENT token) tries to release. The
    // store must NOT delete the row, because the stored token != stale.
    await store.release(key, 'some-other-stale-token');

    // The live claim is intact → a fresh claim is still a duplicate.
    expect(await store.claim(key)).toBeNull();
  });

  it('a release with the MATCHING token deletes the claim', async () => {
    const key = buildWebhookIdempotencyKey('tnt_a', 'mpesa-stk', 'RCPT_CAS2');

    const token = await store.claim(key);
    expect(token).toBeTruthy();

    // Matching token → compare-and-delete succeeds.
    await store.release(key, token!);

    // Key is free → reclaimable.
    expect(await store.claim(key)).toBeTruthy();
  });

  it('two distinct claims of the same key (after release) get distinct tokens', async () => {
    const key = buildWebhookIdempotencyKey('tnt_a', 'mpesa-stk', 'RCPT_TOK');
    const t1 = await store.claim(key);
    expect(t1).toBeTruthy();
    await store.release(key, t1!);
    const t2 = await store.claim(key);
    expect(t2).toBeTruthy();
    expect(t2).not.toBe(t1);
  });

  it('builds a stable, tenant-scoped, provider-namespaced key', () => {
    expect(buildWebhookIdempotencyKey('tnt_a', 'mpesa-stk', 'RCPT1')).toBe(
      'tnt_a:mpesa-stk:RCPT1',
    );
    // null tenant falls back to a dedicated global namespace.
    expect(buildWebhookIdempotencyKey(null, 'mpesa-c2b', 'TX')).toBe(
      'global:mpesa-c2b:TX',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// Redis adapter — MUST-FIX 2: SET NX PX <token> + Lua compare-and-delete
// ─────────────────────────────────────────────────────────────────────

/**
 * Minimal in-memory fake of the ioredis surface the store depends on:
 * `SET key val PX ttl NX` and `EVAL <lua> 1 key token`. The Lua we pass
 * is the compare-and-delete script; we don't run a Lua VM, we just honour
 * its contract (delete only when GET(key) === token).
 */
function makeFakeRedis(): RedisLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async set(key, value, _px, _ttlMs, _nx) {
      if (store.has(key)) return null; // NX → already present
      store.set(key, value);
      return 'OK';
    },
    async del(key) {
      const had = store.has(key);
      store.delete(key);
      return had ? 1 : 0;
    },
    async eval(_script, _numKeys, ...args) {
      // Compare-and-delete: only remove when stored value matches token.
      const key = String(args[0]);
      const token = String(args[1]);
      // eslint-disable-next-line security/detect-possible-timing-attacks -- reason: test assertion in an in-memory mock, not a production secret comparison
      if (store.get(key) === token) {
        store.delete(key);
        return 1;
      }
      return 0;
    },
  };
}

describe('createRedisIdempotencyStore (M3 + MUST-FIX 2 compare-and-delete)', () => {
  it('claim uses SET NX and returns a token; duplicate claim returns null', async () => {
    const redis = makeFakeRedis();
    const store = createRedisIdempotencyStore(redis);
    const key = buildWebhookIdempotencyKey('tnt_a', 'mpesa-stk', 'R1');

    const token = await store.claim(key);
    expect(token).toBeTruthy();
    // The stored Redis value is the token (so release can compare it).
    expect(redis.store.get(key)).toBe(token);

    // Duplicate claim → NX fails → null.
    expect(await store.claim(key)).toBeNull();
  });

  it('release with a NON-matching token leaves the live claim intact', async () => {
    const redis = makeFakeRedis();
    const store = createRedisIdempotencyStore(redis);
    const key = buildWebhookIdempotencyKey('tnt_a', 'mpesa-stk', 'R2');

    const token = await store.claim(key);
    expect(token).toBeTruthy();

    await store.release(key, 'stale-token');
    // Not deleted → still a duplicate.
    expect(redis.store.has(key)).toBe(true);
    expect(await store.claim(key)).toBeNull();
  });

  it('release with the MATCHING token deletes the claim', async () => {
    const redis = makeFakeRedis();
    const store = createRedisIdempotencyStore(redis);
    const key = buildWebhookIdempotencyKey('tnt_a', 'mpesa-stk', 'R3');

    const token = await store.claim(key);
    await store.release(key, token!);
    expect(redis.store.has(key)).toBe(false);
    expect(await store.claim(key)).toBeTruthy();
  });
});
