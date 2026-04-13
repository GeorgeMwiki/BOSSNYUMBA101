/**
 * Redis-backed adapters for the M-Pesa idempotency, replay, and
 * rate-limit stores. Required for multi-pod production deployments so
 * that a retry hitting a different pod still hits the shared state.
 *
 * Each adapter wraps an `ioredis` client (injected, not imported
 * directly) so the dependency is optional — the factory in
 * `store-factory.ts` falls back to in-memory when Redis is unavailable.
 *
 * NOTE: ioredis must be added as a dependency before production use.
 * The store-factory reads `MPESA_STORE_BACKEND` env to pick the
 * implementation at runtime.
 */

import type { IdempotencyStore, IdempotencyLookup } from './idempotency';
import type { ReplayStore } from './replay-store';
import type { RateLimiter, RateLimitResult } from './rate-limit';

// -------------------------------------------------------------------------
// Redis client interface (subset of ioredis that we actually call)
// -------------------------------------------------------------------------

export interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<string | null>;
  del(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}

// -------------------------------------------------------------------------
// Redis Idempotency Store
// -------------------------------------------------------------------------

const IDEM_PREFIX = 'mpesa:idem:';
const IDEM_TTL_SECONDS = 3600; // 1h default

export class RedisIdempotencyStore<T> implements IdempotencyStore<T> {
  constructor(
    private readonly redis: RedisClientLike,
    private readonly ttl: number = IDEM_TTL_SECONDS,
  ) {}

  async begin(key: string): Promise<IdempotencyLookup<T>> {
    const rk = `${IDEM_PREFIX}${key}`;
    // Try atomic SET NX EX — if set succeeds, we own the key.
    const set = await this.redis.set(rk, JSON.stringify({ status: 'in-flight' }), 'NX', 'EX', this.ttl);
    if (set === 'OK') {
      return { status: 'new' };
    }
    // Key exists — check if it's in-flight or completed.
    const raw = await this.redis.get(rk);
    if (!raw) return { status: 'new' }; // expired between set and get
    try {
      const parsed = JSON.parse(raw);
      if (parsed.status === 'in-flight') return { status: 'in-flight' };
      if (parsed.status === 'completed' && parsed.value !== undefined) {
        return { status: 'replayed', value: parsed.value as T };
      }
    } catch {
      // Corrupt data — treat as new.
      await this.redis.del(rk);
    }
    return { status: 'new' };
  }

  async complete(key: string, value: T): Promise<void> {
    const rk = `${IDEM_PREFIX}${key}`;
    await this.redis.set(rk, JSON.stringify({ status: 'completed', value }), 'EX', this.ttl);
  }

  async fail(key: string): Promise<void> {
    await this.redis.del(`${IDEM_PREFIX}${key}`);
  }

  async clear(): Promise<void> {
    const keys = await this.redis.keys(`${IDEM_PREFIX}*`);
    for (const k of keys) await this.redis.del(k);
  }

  size(): number {
    // Not efficiently queryable from Redis — return -1 as sentinel.
    return -1;
  }
}

// -------------------------------------------------------------------------
// Redis Replay Store
// -------------------------------------------------------------------------

const REPLAY_PREFIX = 'mpesa:replay:';
const REPLAY_TTL_SECONDS = 86400; // 24h

export class RedisReplayStore implements ReplayStore {
  constructor(
    private readonly redis: RedisClientLike,
    private readonly ttl: number = REPLAY_TTL_SECONDS,
  ) {}

  remember(key: string): boolean {
    // Synchronous interface — use the async version below for Redis.
    // This method exists for interface compat with InMemoryReplayStore.
    // Callers using Redis MUST call rememberAsync instead.
    throw new Error(
      'RedisReplayStore.remember() is synchronous but Redis is async. ' +
      'Use rememberAsync() instead, or wire through the async store factory.',
    );
  }

  async rememberAsync(key: string): Promise<boolean> {
    const rk = `${REPLAY_PREFIX}${key}`;
    const set = await this.redis.set(rk, '1', 'NX', 'EX', this.ttl);
    return set === 'OK'; // true = first time seen, false = duplicate
  }

  has(key: string): boolean {
    throw new Error('Use hasAsync() for Redis-backed replay store.');
  }

  async hasAsync(key: string): Promise<boolean> {
    const raw = await this.redis.get(`${REPLAY_PREFIX}${key}`);
    return raw !== null;
  }

  clear(): void {
    // Fire-and-forget async clear.
    void this.clearAsync();
  }

  async clearAsync(): Promise<void> {
    const keys = await this.redis.keys(`${REPLAY_PREFIX}*`);
    for (const k of keys) await this.redis.del(k);
  }

  size(): number {
    return -1;
  }
}

// -------------------------------------------------------------------------
// Redis Rate Limiter
// -------------------------------------------------------------------------

const RATE_PREFIX = 'mpesa:rate:';

export class RedisRateLimiter implements RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(
    private readonly redis: RedisClientLike,
    maxRequests: number = 10,
    windowMs: number = 60_000,
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(key: string): RateLimitResult {
    // Synchronous interface — use checkAsync for Redis.
    throw new Error('Use checkAsync() for Redis-backed rate limiter.');
  }

  async checkAsync(key: string): Promise<RateLimitResult> {
    const rk = `${RATE_PREFIX}${key}`;
    const count = await this.redis.incr(rk);

    if (count === 1) {
      // First request in this window — set the expiry.
      await this.redis.expire(rk, Math.ceil(this.windowMs / 1000));
    }

    const ttl = await this.redis.ttl(rk);
    const resetMs = ttl > 0 ? ttl * 1000 : this.windowMs;

    if (count > this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetInMs: resetMs,
      };
    }

    return {
      allowed: true,
      remaining: this.maxRequests - count,
      resetInMs: resetMs,
    };
  }

  reset(): void {
    void this.resetAsync();
  }

  async resetAsync(): Promise<void> {
    const keys = await this.redis.keys(`${RATE_PREFIX}*`);
    for (const k of keys) await this.redis.del(k);
  }
}
