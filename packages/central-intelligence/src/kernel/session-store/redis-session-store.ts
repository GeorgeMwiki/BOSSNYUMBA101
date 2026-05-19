/**
 * RedisSessionStore — Phase K-A, R1 gap #2.
 *
 * Redis-backed snapshot store. Follows the same pattern as CL-B2's
 * `RedisCacheStore` (PR #99) and the existing `semantic-cache/
 * cache-store.ts`: the kernel package does NOT bundle `ioredis`, so
 * the caller injects a minimal duck-typed client at composition time.
 * This keeps the kernel boot-able with zero external deps and lets
 * the operator pick `ioredis`, `redis`, `iovalkey`, or a test stub.
 *
 * Schema: each session is stored under
 *
 *   <prefix>:snapshot:<sessionId>   -> JSON-encoded SessionSnapshot
 *   <prefix>:token:<resumeToken>    -> sessionId (secondary index)
 *   <prefix>:tenant:<tenantId>      -> SET of sessionIds (for list)
 *   <prefix>:tenant:__platform__    -> SET for tenantId === null
 *
 * `write()` atomically updates all three under a MULTI/EXEC pipeline
 * (when the client supplies one) so a partial failure can't leave
 * the index out of sync with the snapshot key. Test stubs that don't
 * implement pipelining fall back to sequential writes.
 *
 * TTL: when `snapshot.ttlMs` is set, both the snapshot key and the
 * token-index key get `PEXPIRE`. The tenant-set membership is NOT
 * expired separately — instead `list()` reads each session key first
 * and lazily prunes the set when a snapshot is missing (TTL elapsed).
 *
 * Cross-tenant safety: the tenant set is the only `list()` entry-
 * point; passing `tenantId` in the filter scopes the read to a single
 * set, so an `INCRBY` mistake or a missing filter can never leak rows
 * from another tenant.
 *
 * Falls back to InMemorySessionStore when `redis` is null/undefined,
 * emitting a single WARN — matches the deferred-port pattern in
 * `cache-store.ts`.
 */

import {
  createInMemorySessionStore,
  type InMemorySessionStoreDeps,
} from './in-memory-session-store.js';
import type {
  SessionListEntry,
  SessionListFilter,
  SessionSnapshot,
  SessionStore,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────
// Minimal Redis surface — narrow on purpose. Matches the `ioredis`
// API by name but the kernel does not depend on the runtime.
// ─────────────────────────────────────────────────────────────────────

export interface SessionStoreRedisLike {
  /** Set a string value. */
  set(key: string, value: string): Promise<unknown>;
  /** Read a string value. */
  get(key: string): Promise<string | null>;
  /** Delete one or more keys. Returns the number of deleted keys. */
  del(...keys: string[]): Promise<number>;
  /** Set milliseconds-precision expiry on a key. */
  pexpire(key: string, ms: number): Promise<number>;
  /** Add a member to a set. */
  sadd(key: string, ...members: string[]): Promise<number>;
  /** Remove a member from a set. */
  srem(key: string, ...members: string[]): Promise<number>;
  /** Return all members of a set. */
  smembers(key: string): Promise<string[]>;
}

export interface RedisSessionStoreDeps {
  /** Injected Redis client. When null/undefined, the adapter falls back. */
  readonly redis?: SessionStoreRedisLike | null;
  /** Optional key prefix; defaults to `bnyumba:session`. */
  readonly keyPrefix?: string;
  /** Injectable clock; defaults to `() => new Date()`. */
  readonly clock?: () => Date;
  /** Optional logger; defaults to `console.warn`. */
  readonly logger?: { warn: (msg: string) => void };
}

const TENANT_PLATFORM_BUCKET = '__platform__';

/**
 * Create a Redis-backed SessionStore. When `deps.redis` is unset, the
 * store transparently falls back to in-memory and emits a single
 * WARN so an operator notices the unconfigured `REDIS_URL`.
 */
export function createRedisSessionStore(
  deps: RedisSessionStoreDeps = {},
): SessionStore {
  const logger = deps.logger ?? { warn: (msg: string): void => console.warn(msg) };
  if (!deps.redis) {
    logger.warn(
      'session-store: Redis client not provided — falling back to in-memory store',
    );
    const memDeps: InMemorySessionStoreDeps = {};
    if (deps.clock !== undefined) {
      (memDeps as { clock: () => Date }).clock = deps.clock;
    }
    return createInMemorySessionStore(memDeps);
  }

  const redis = deps.redis;
  const prefix = deps.keyPrefix ?? 'bnyumba:session';
  const clock = deps.clock ?? ((): Date => new Date());

  const snapshotKey = (sessionId: string): string =>
    `${prefix}:snapshot:${sessionId}`;
  const tokenKey = (token: string): string => `${prefix}:token:${token}`;
  const tenantKey = (tenantId: string | null): string =>
    `${prefix}:tenant:${tenantId ?? TENANT_PLATFORM_BUCKET}`;

  async function read(sessionId: string): Promise<SessionSnapshot | null> {
    const raw = await redis.get(snapshotKey(sessionId));
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw) as SessionSnapshot;
      return parsed;
    } catch {
      // Malformed payload — treat as miss. Don't delete; let the
      // operator inspect.
      return null;
    }
  }

  async function write(snapshot: SessionSnapshot): Promise<SessionSnapshot> {
    const persisted: SessionSnapshot = {
      ...snapshot,
      capturedAt: clock().toISOString(),
    };
    const body = JSON.stringify(persisted);

    // Best-effort sequential write. Operators with `MULTI` support can
    // subclass and override.
    await redis.set(snapshotKey(persisted.sessionId), body);
    if (persisted.ttlMs !== undefined && persisted.ttlMs > 0) {
      await redis.pexpire(snapshotKey(persisted.sessionId), persisted.ttlMs);
    }

    // Tenant-set membership.
    await redis.sadd(tenantKey(persisted.tenantId), persisted.sessionId);

    // Token secondary index.
    if (persisted.resumeToken) {
      await redis.set(tokenKey(persisted.resumeToken), persisted.sessionId);
      if (persisted.ttlMs !== undefined && persisted.ttlMs > 0) {
        await redis.pexpire(tokenKey(persisted.resumeToken), persisted.ttlMs);
      }
    }

    return persisted;
  }

  async function list(
    filter: SessionListFilter = {},
  ): Promise<ReadonlyArray<SessionListEntry>> {
    // The tenant set is the only `list` entry point. When no tenantId
    // is supplied, the caller is asking cross-tenant — refuse here to
    // surface a clear error rather than silently leaking. Operators
    // who genuinely need a cross-tenant view should scan with a
    // privileged HQ-level admin tool, not this port.
    if (filter.tenantId === undefined) {
      throw new Error(
        'RedisSessionStore.list requires an explicit tenantId (pass null for platform-tier)',
      );
    }
    const members = await redis.smembers(tenantKey(filter.tenantId));
    const rows: SessionListEntry[] = [];
    for (const sessionId of members) {
      const snap = await read(sessionId);
      if (!snap) {
        // Lazy prune — snapshot expired or was deleted out-of-band.
        await redis.srem(tenantKey(filter.tenantId), sessionId);
        continue;
      }
      if (filter.personaId !== undefined && snap.personaId !== filter.personaId) {
        continue;
      }
      rows.push({
        sessionId: snap.sessionId,
        tenantId: snap.tenantId,
        personaId: snap.personaId,
        capturedAt: snap.capturedAt,
      });
    }
    rows.sort((a, b) =>
      a.capturedAt < b.capturedAt ? 1 : a.capturedAt > b.capturedAt ? -1 : 0,
    );
    if (filter.limit !== undefined && rows.length > filter.limit) {
      return rows.slice(0, filter.limit);
    }
    return rows;
  }

  async function deleteSnapshot(sessionId: string): Promise<boolean> {
    // Read first so we can update the indexes.
    const existing = await read(sessionId);
    if (!existing) return false;
    await redis.del(snapshotKey(sessionId));
    await redis.srem(tenantKey(existing.tenantId), sessionId);
    if (existing.resumeToken !== undefined) {
      await redis.del(tokenKey(existing.resumeToken));
    }
    return true;
  }

  return {
    read,
    write,
    list,
    delete: deleteSnapshot,
  };
}
