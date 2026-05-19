/**
 * Refresh-token blocklist (AM-1).
 *
 * The existing `token-blocklist.ts` is process-local and tracks ACCESS-
 * token jtis. For the AM-1 cookie-auth migration we additionally need
 * to invalidate REFRESH-token jtis across all gateway replicas (HPA
 * runs 3-20 of them), because a stolen refresh cookie is the
 * keys-to-the-kingdom credential: it can mint fresh 1-hour access
 * tokens for the full 7-day refresh window.
 *
 * Storage:
 *   - Redis when `REDIS_URL` is set (cluster-wide, atomic SETEX).
 *   - In-process Map fallback when Redis is unavailable so dev / CI
 *     never block on a missing dependency. Single-replica deployments
 *     get correctness; multi-replica deployments without Redis would
 *     get partial coverage — the operator visibility is via the
 *     one-shot warn line emitted at first use.
 *
 * Key shape: `refresh-blocklist:{jti}` → "1" (presence == revoked)
 * TTL: `exp_seconds_unix - now_seconds`, capped at REFRESH_TTL so a
 * malformed exp can never push a record past the legitimate lifetime.
 */

import type { Redis as IoRedisClient } from 'ioredis';

const KEY_PREFIX = 'refresh-blocklist:';
const MAX_TTL_SECONDS = 60 * 60 * 24 * 7; // 7d — refresh token TTL

interface BlocklistStore {
  revoke(jti: string, expSeconds: number): Promise<void>;
  isRevoked(jti: string): Promise<boolean>;
  /** Test helper only. */
  clear(): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

class InMemoryRefreshBlocklist implements BlocklistStore {
  private readonly entries = new Map<string, number>(); // jti -> expiresAtMs

  constructor() {
    // Reap stale entries hourly. `.unref()` so the timer never blocks
    // process exit during graceful shutdown.
    setInterval(() => this.reap(), 60 * 60 * 1000).unref?.();
  }

  async revoke(jti: string, expSeconds: number): Promise<void> {
    if (!jti) return;
    const ttlSeconds = Math.max(0, Math.min(expSeconds - Math.floor(Date.now() / 1000), MAX_TTL_SECONDS));
    if (ttlSeconds === 0) return;
    this.entries.set(jti, Date.now() + ttlSeconds * 1000);
  }

  async isRevoked(jti: string): Promise<boolean> {
    if (!jti) return false;
    const expiresAt = this.entries.get(jti);
    if (expiresAt === undefined) return false;
    if (expiresAt <= Date.now()) {
      this.entries.delete(jti);
      return false;
    }
    return true;
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  private reap(): void {
    const now = Date.now();
    for (const [jti, expiresAt] of this.entries) {
      if (expiresAt <= now) this.entries.delete(jti);
    }
  }
}

// ---------------------------------------------------------------------------
// Redis-backed
// ---------------------------------------------------------------------------

class RedisRefreshBlocklist implements BlocklistStore {
  constructor(private readonly redis: IoRedisClient) {}

  async revoke(jti: string, expSeconds: number): Promise<void> {
    if (!jti) return;
    const ttl = Math.max(0, Math.min(expSeconds - Math.floor(Date.now() / 1000), MAX_TTL_SECONDS));
    if (ttl === 0) return;
    // SETEX is atomic and self-expiring; no separate EXPIRE needed.
    await this.redis.set(`${KEY_PREFIX}${jti}`, '1', 'EX', ttl);
  }

  async isRevoked(jti: string): Promise<boolean> {
    if (!jti) return false;
    const value = await this.redis.get(`${KEY_PREFIX}${jti}`);
    return value !== null;
  }

  async clear(): Promise<void> {
    // Keyspace-scan delete — test-only. Production deletion uses TTL.
    const stream = this.redis.scanStream({ match: `${KEY_PREFIX}*`, count: 200 });
    for await (const keys of stream as AsyncIterable<string[]>) {
      if (keys.length) await this.redis.del(...keys);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton with lazy init + degraded-mode fallback
// ---------------------------------------------------------------------------

let backend: BlocklistStore | null = null;
let warned = false;

/**
 * Install a Redis-backed store. Called from `index.ts` after the shared
 * ioredis client is constructed — keeps Redis ownership in one place.
 */
export function installRedisRefreshBlocklist(redis: IoRedisClient): void {
  backend = new RedisRefreshBlocklist(redis);
}

/**
 * Reset for tests — restores the in-memory fallback so each test has a
 * clean store. Not exported from the package index.
 */
export function __resetRefreshBlocklistForTests(): void {
  backend = new InMemoryRefreshBlocklist();
  warned = false;
}

function getBackend(): BlocklistStore {
  if (!backend) {
    if (!warned && process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.warn(
        'refresh-token-blocklist: REDIS_URL unset or installRedisRefreshBlocklist() not called — falling back to in-memory store. Multi-replica deployments will leak revoked refresh tokens across replicas.'
      );
      warned = true;
    }
    backend = new InMemoryRefreshBlocklist();
  }
  return backend;
}

export const refreshTokenBlocklist = {
  async revoke(jti: string, expSeconds: number): Promise<void> {
    await getBackend().revoke(jti, expSeconds);
  },
  async isRevoked(jti: string): Promise<boolean> {
    return getBackend().isRevoked(jti);
  },
  async clear(): Promise<void> {
    await getBackend().clear();
  },
};

export type { BlocklistStore };
