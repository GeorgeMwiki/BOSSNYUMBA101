/**
 * Idempotency store abstraction for POST /api/v1/payments.
 *
 * Two implementations:
 *   - InMemoryIdempotencyStore: per-process Map, safe only for single-replica
 *     or local dev. Prunes expired entries every 10 minutes.
 *   - RedisIdempotencyStore: shared across replicas via Redis string keys with
 *     PX (millisecond) expiry. JSON-encoded.
 *
 * Selection is driven by `process.env.IDEMPOTENCY_STORE`:
 *   - 'redis'  -> Redis-backed (REDIS_URL required; throws at boot if unset)
 *   - anything else / unset -> in-memory
 *
 * Failure-mode semantics for Redis:
 *   On connection/command errors we FAIL-OPEN at the request level: `.get()`
 *   returns `null` so the caller re-executes the payment creation path.
 *   Rationale: the alternative (propagating the Redis error) would drop
 *   payment requests while Redis is unhealthy, which is strictly worse than
 *   the duplicate-payment risk that a missed cache hit briefly reintroduces.
 *   Callers should still supply idempotencyKey so Stripe/M-Pesa provider-side
 *   idempotency catches duplicates even if our cache layer misses.
 */
import IORedis, { Redis as RedisClient } from 'ioredis';
import { Logger as ObsLogger } from '@bossnyumba/observability';

export interface IdempotencyValue {
  status: number;
  body: unknown;
}

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyValue | null>;
  set(key: string, value: IdempotencyValue, ttlMs: number): Promise<void>;
  close?(): Promise<void>;
}

const logger = new ObsLogger({
  service: 'payments-ledger',
  component: 'idempotency-store',
});

// -----------------------------------------------------------------------------
// In-memory implementation
// -----------------------------------------------------------------------------
interface InMemoryEntry {
  status: number;
  body: unknown;
  expiresAt: number;
}

class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly cache = new Map<string, InMemoryEntry>();
  private readonly pruneTimer: NodeJS.Timeout;

  constructor() {
    // Best-effort pruning every 10 minutes so the Map doesn't grow unbounded.
    this.pruneTimer = setInterval(() => this.prune(), 10 * 60 * 1000);
    this.pruneTimer.unref?.();
  }

  private prune(): void {
    const now = Date.now();
    for (const [k, v] of this.cache) {
      if (v.expiresAt < now) this.cache.delete(k);
    }
  }

  async get(key: string): Promise<IdempotencyValue | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return { status: entry.status, body: entry.body };
  }

  async set(key: string, value: IdempotencyValue, ttlMs: number): Promise<void> {
    this.cache.set(key, {
      status: value.status,
      body: value.body,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async close(): Promise<void> {
    clearInterval(this.pruneTimer);
    this.cache.clear();
  }
}

// -----------------------------------------------------------------------------
// Redis implementation
// -----------------------------------------------------------------------------
class RedisIdempotencyStore implements IdempotencyStore {
  private readonly client: RedisClient;
  private readonly keyPrefix = 'payments-ledger:idempotency:';

  constructor(redisUrl: string) {
    this.client = new IORedis(redisUrl, {
      // Keep retries bounded so a dead Redis doesn't indefinitely stall boot;
      // run-time calls are individually guarded below.
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.client.on('error', (err: Error) => {
      // ioredis emits 'error' on every failed reconnect attempt — log at warn
      // to avoid flooding error channels, escalate only if connection closes.
      logger.warn('Redis idempotency store error', { error: err.message });
    });

    this.client.on('end', () => {
      logger.warn('Redis idempotency store connection closed');
    });
  }

  async get(key: string): Promise<IdempotencyValue | null> {
    try {
      const raw = await this.client.get(this.keyPrefix + key);
      if (!raw) return null;
      return JSON.parse(raw) as IdempotencyValue;
    } catch (err) {
      // FAIL-OPEN: caller re-executes the payment creation path. See file
      // header for rationale.
      logger.error('Redis idempotency get failed; failing open', err as Error, {
        key,
      });
      return null;
    }
  }

  async set(key: string, value: IdempotencyValue, ttlMs: number): Promise<void> {
    try {
      const payload = JSON.stringify(value);
      await this.client.set(this.keyPrefix + key, payload, 'PX', ttlMs);
    } catch (err) {
      // Non-fatal: a failed cache write means the next retry won't short-circuit,
      // but the payment was still created successfully.
      logger.error('Redis idempotency set failed; entry not cached', err as Error, {
        key,
      });
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.quit();
    } catch (err) {
      // Force-disconnect if graceful quit failed.
      this.client.disconnect();
      logger.warn('Redis idempotency store quit failed; forced disconnect', {
        error: (err as Error).message,
      });
    }
  }
}

// -----------------------------------------------------------------------------
// Factory
// -----------------------------------------------------------------------------
export function createIdempotencyStore(): IdempotencyStore {
  const mode = process.env.IDEMPOTENCY_STORE;

  if (mode === 'redis') {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error(
        'IDEMPOTENCY_STORE=redis requires REDIS_URL to be set'
      );
    }
    logger.info('Using Redis-backed idempotency store', {
      // Don't log credentials — REDIS_URL may contain auth.
      hasUrl: true,
    });
    return new RedisIdempotencyStore(redisUrl);
  }

  logger.info('Using in-process idempotency store (single-replica only)');
  return new InMemoryIdempotencyStore();
}
