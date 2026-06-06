/**
 * Durable, tenant-scoped, crash-safe webhook idempotency (M3 / M7 / M8).
 *
 * Replaces the process-local `CallbackDeduplicator` (a `Map` that even
 * `.clear()`ed every 24h) with a store that survives restarts and is
 * shared across replicas:
 *
 *   - Redis `SET key val NX EX <ttl>` when `REDIS_URL` is set — atomic
 *     "claim or fail" with automatic expiry.
 *   - Otherwise a Postgres unique index (the existing `idempotency_keys`
 *     table) — `INSERT … ON CONFLICT DO NOTHING` is the atomic claim.
 *
 * The contract is reserve / release rather than the connectors'
 * `seenRecently` (record-and-check):
 *
 *   - {@link DurableIdempotencyStore.claim} atomically RESERVES the key.
 *     A non-null string (a unique per-claim TOKEN) → newly reserved, the
 *     caller MUST process the callback and keep the token to release it.
 *     `null` → already reserved/recorded, the caller MUST skip (dup).
 *   - {@link DurableIdempotencyStore.release} undoes a reservation via a
 *     COMPARE-AND-DELETE keyed on the token from {@link claim}: it only
 *     removes the reservation when the stored token still matches. The
 *     webhook handler calls it when processing FAILS so the key is not
 *     burned and a provider retry can reprocess (M8). On success the
 *     handler does NOT release, so the key stays recorded and future
 *     retries are deduplicated.
 *
 * Why the token (MUST-FIX 2): an unconditional `release(key)` can delete a
 * DIFFERENT delivery's claim. If delivery #1 claims, the key TTL-expires,
 * delivery #2 re-wins the claim, then delivery #1's late/transient failure
 * fires `release` — without a token it would delete #2's live claim and
 * let a #3 reprocess (double SMS/events/credit). Compare-and-delete on a
 * unique per-claim token closes that race: a stale releaser holds the old
 * token, which no longer matches, so the delete is a no-op.
 *
 * Why reserve/release instead of literal "record only after success":
 * checking-then-recording is a race — two simultaneous deliveries of the
 * same callback would both see "not recorded" and both process, double-
 * crediting the ledger. Reserving atomically up front closes that race
 * while release-on-failure preserves the "a failure must not burn the
 * key" guarantee. The connectors `IdempotencyStore` is structurally a
 * subset (`seenRecently` ≈ `claim`); a `seenRecently` adapter is exposed
 * below for call sites that only need record-and-check.
 *
 * Keys are built with {@link buildWebhookIdempotencyKey}, which prefixes
 * the tenant id so a forged/shared external id for one tenant cannot
 * collide with another tenant's dedup state (M7).
 */
import { randomUUID } from 'node:crypto';
import type { DatabaseClient } from '@bossnyumba/database';
import { idempotencyKeys, IDEMPOTENCY_TTL_MS } from '@bossnyumba/database';
import { and, eq, lt } from 'drizzle-orm';

/** Default retention for a recorded webhook key. Matches Safaricom's retry window. */
export const WEBHOOK_IDEMPOTENCY_TTL_MS = IDEMPOTENCY_TTL_MS; // 24h

/** Namespace for webhook idempotency rows in the shared `idempotency_keys` table. */
const WEBHOOK_RESOURCE_KIND_PREFIX = 'webhook';

export type WebhookProvider =
  | 'mpesa-stk'
  | 'mpesa-c2b'
  | 'mpesa-b2c'
  | 'stripe'
  | 'gepg';

/**
 * Build a tenant-scoped, provider-namespaced idempotency key.
 *
 * `tenantId === null` is allowed only for callbacks that arrive before a
 * tenant is resolved; those land in a dedicated `global` namespace and
 * MUST NOT be used to gate cross-tenant state changes without a
 * secondary tenant check (mirrors the old `CallbackDeduplicator.tenantKey`).
 */
export function buildWebhookIdempotencyKey(
  tenantId: string | null,
  provider: WebhookProvider,
  externalId: string,
): string {
  return `${tenantId ?? 'global'}:${provider}:${externalId}`;
}

export interface DurableIdempotencyStore {
  /**
   * Atomically reserve `key`. Returns a unique, opaque release TOKEN when
   * it was newly reserved (caller MUST process and keep the token), or
   * `null` if it was already present (caller MUST skip — duplicate).
   */
  claim(key: string): Promise<string | null>;

  /**
   * Release a previously-claimed key so it can be reprocessed. Called
   * when the handler FAILS (M8). COMPARE-AND-DELETE: only removes the
   * reservation when the stored token matches `token` (so a stale
   * releaser cannot delete a newer delivery's claim — MUST-FIX 2). A
   * no-op if the key is unknown or the token no longer matches.
   */
  release(key: string, token: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────
// In-memory reference implementation (tests / dev / DB-less local runs)
// ─────────────────────────────────────────────────────────────────────

/**
 * In-memory store. NOT durable across processes — single-process only.
 * Used in tests and as the dev/local fallback when neither REDIS_URL nor
 * a database client is available. Carries a TTL so long-lived dev
 * processes don't grow unbounded.
 */
export function createInMemoryDurableIdempotencyStore(
  ttlMs: number = WEBHOOK_IDEMPOTENCY_TTL_MS,
): DurableIdempotencyStore & { readonly size: () => number } {
  // key -> { token, expiry epoch ms }. The token enables compare-and-
  // delete on release so a stale releaser cannot drop a newer claim.
  const seen = new Map<string, { token: string; expiry: number }>();
  const live = (now: number, entry: { expiry: number } | undefined): boolean =>
    entry !== undefined && entry.expiry > now;
  return {
    async claim(key: string): Promise<string | null> {
      const now = Date.now();
      if (live(now, seen.get(key))) return null;
      const token = randomUUID();
      seen.set(key, { token, expiry: now + ttlMs });
      return token;
    },
    async release(key: string, token: string): Promise<void> {
      const entry = seen.get(key);
      // Compare-and-delete: only remove our own claim (MUST-FIX 2).
      if (entry && entry.token === token) seen.delete(key);
    },
    size: () => seen.size,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Redis implementation — SET NX EX
// ─────────────────────────────────────────────────────────────────────

/**
 * Minimal Redis surface we depend on. Matches `ioredis`:
 *   - `set(key, val, 'PX', ttlMs, 'NX')` → 'OK' if set, null if it existed.
 *   - `del(key)` → number of keys removed.
 *   - `eval(lua, numKeys, ...args)` → script result (used for the atomic
 *     compare-and-delete on release).
 */
export interface RedisLike {
  set(
    key: string,
    value: string,
    mode1: 'PX',
    ttlMs: number,
    mode2: 'NX',
  ): Promise<string | null>;
  del(key: string): Promise<number>;
  eval(
    script: string,
    numKeys: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
}

/**
 * Atomic compare-and-delete: delete the key only when its current value
 * equals the supplied token. KEYS[1] = key, ARGV[1] = token. Returns 1
 * when deleted, 0 otherwise. This is the MUST-FIX 2 guard for Redis — a
 * stale releaser holding an old token cannot drop a newer claim.
 */
const RELEASE_IF_TOKEN_MATCHES_LUA =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

export function createRedisIdempotencyStore(
  redis: RedisLike,
  ttlMs: number = WEBHOOK_IDEMPOTENCY_TTL_MS,
): DurableIdempotencyStore {
  return {
    async claim(key: string): Promise<string | null> {
      // NX = only set if absent → atomic claim. We store a unique TOKEN
      // (not '1') so release can compare-and-delete. 'OK' means we won
      // the claim; null means another delivery already holds it (dup).
      const token = randomUUID();
      const result = await redis.set(key, token, 'PX', ttlMs, 'NX');
      return result === 'OK' ? token : null;
    },
    async release(key: string, token: string): Promise<void> {
      // Compare-and-delete via a single atomic Lua eval (MUST-FIX 2).
      await redis.eval(RELEASE_IF_TOKEN_MATCHES_LUA, 1, key, token);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Postgres implementation — unique index on idempotency_keys
// ─────────────────────────────────────────────────────────────────────

/**
 * Postgres-backed store using the existing `idempotency_keys` table.
 * The unique index `(tenant_id, key, resource_kind)` (and the anon
 * variant) makes `INSERT … ON CONFLICT DO NOTHING` an atomic claim:
 * exactly one concurrent INSERT inserts a row, the rest no-op.
 *
 * We store the full tenant-scoped key in the `key` column and a fixed
 * `resource_kind`, with `tenant_id = null` — the key itself already
 * carries the tenant prefix (M7), so we rely on the anonymous unique
 * index and avoid a tenants FK dependency for webhook dedup rows.
 */
export function createPostgresIdempotencyStore(
  db: DatabaseClient,
  ttlMs: number = WEBHOOK_IDEMPOTENCY_TTL_MS,
): DurableIdempotencyStore {
  const RESOURCE_KIND = `${WEBHOOK_RESOURCE_KIND_PREFIX}.callback`;
  return {
    async claim(key: string): Promise<string | null> {
      // Opportunistically clear any expired row for this key so a stale
      // record past its TTL does not block a legitimate reprocess.
      await db
        .delete(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.key, key),
            eq(idempotencyKeys.resourceKind, RESOURCE_KIND),
            lt(idempotencyKeys.expiresAt, new Date()),
          ),
        );

      // The unique per-claim TOKEN is stored in `requestHash` (repurposed
      // for webhook dedup rows — there is no separate token column). It is
      // what release compares against for compare-and-delete (MUST-FIX 2).
      const token = randomUUID();
      const inserted = await db
        .insert(idempotencyKeys)
        .values({
          tenantId: null,
          key,
          resourceKind: RESOURCE_KIND,
          // requestHash carries the release token for this claim.
          requestHash: token,
          state: 'completed',
          expiresAt: new Date(Date.now() + ttlMs),
        })
        .onConflictDoNothing()
        .returning({ id: idempotencyKeys.id });

      // A returned row means we won the claim → hand back the token; empty
      // means a row already existed (duplicate) → null.
      return inserted.length > 0 ? token : null;
    },
    async release(key: string, token: string): Promise<void> {
      // Compare-and-delete: only remove the row when the stored token
      // matches, so a stale releaser cannot drop a newer claim (MUST-FIX 2).
      await db
        .delete(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.key, key),
            eq(idempotencyKeys.resourceKind, RESOURCE_KIND),
            eq(idempotencyKeys.requestHash, token),
          ),
        );
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Connectors-compatible adapter (seenRecently)
// ─────────────────────────────────────────────────────────────────────

/**
 * Adapt a {@link DurableIdempotencyStore} to the connectors'
 * `IdempotencyStore.seenRecently` contract (record-and-check). Useful
 * where a call site only needs "have I seen this?" without the
 * release-on-failure capability. `seenRecently` returns `true` when the
 * key was already present (= `!claim`).
 */
export function asSeenRecentlyStore(
  store: DurableIdempotencyStore,
): { seenRecently(key: string): Promise<boolean> } {
  return {
    async seenRecently(key: string): Promise<boolean> {
      // claim returns a token (truthy) when newly reserved, null when it
      // was already present. `seenRecently` is "already present" = no token.
      const token = await store.claim(key);
      return token === null;
    },
  };
}
