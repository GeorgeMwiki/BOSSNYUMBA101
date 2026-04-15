/**
 * Redis-backed implementations of the M-Pesa support stores.
 *
 * The adapter accepts a minimal `RedisLike` client interface so callers can
 * plug in ioredis, node-redis, or a test double without a hard dependency.
 */
import type {
  CallbackReplayStore,
  StkIdempotencyStore,
  StkRateLimiter,
} from './stores';

/**
 * Minimal command surface the stores rely on. A real ioredis/node-redis
 * instance satisfies this structurally.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    ...args: Array<string | number>
  ): Promise<string | null | 'OK'>;
  exists(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number | boolean>;
  pexpire?(key: string, ms: number): Promise<number | boolean>;
  del(key: string): Promise<number>;
}

export interface RedisStoreOptions {
  keyPrefix?: string;
}

const DEFAULT_PREFIX = 'mpesa';

function prefix(base: string | undefined, ns: string, key: string): string {
  const root = base && base.length > 0 ? base : DEFAULT_PREFIX;
  return `${root}:${ns}:${key}`;
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

export class RedisStkIdempotencyStore implements StkIdempotencyStore {
  constructor(
    private readonly client: RedisLike,
    private readonly opts: RedisStoreOptions = {}
  ) {}

  private k(key: string): string {
    return prefix(this.opts.keyPrefix, 'idem', key);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(this.k(key));
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(this.k(key), value, 'EX', ttlSeconds);
    } else {
      await this.client.set(this.k(key), value);
    }
  }

  async setIfAbsent(
    key: string,
    value: string,
    ttlSeconds?: number
  ): Promise<boolean> {
    const args: Array<string | number> = ['NX'];
    if (ttlSeconds && ttlSeconds > 0) {
      args.push('EX', ttlSeconds);
    }
    const res = await this.client.set(this.k(key), value, ...args);
    return res === 'OK';
  }
}

// ---------------------------------------------------------------------------
// Callback replay
// ---------------------------------------------------------------------------

export class RedisCallbackReplayStore implements CallbackReplayStore {
  constructor(
    private readonly client: RedisLike,
    private readonly opts: RedisStoreOptions = {}
  ) {}

  private k(key: string): string {
    return prefix(this.opts.keyPrefix, 'replay', key);
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.client.exists(this.k(key));
    return exists > 0;
  }

  async mark(key: string, ttlSeconds?: number): Promise<void> {
    const args: Array<string | number> = [];
    if (ttlSeconds && ttlSeconds > 0) {
      args.push('EX', ttlSeconds);
    }
    await this.client.set(this.k(key), '1', ...args);
  }
}

// ---------------------------------------------------------------------------
// Rate limiter (fixed window, INCR + EXPIRE)
// ---------------------------------------------------------------------------

export class RedisStkRateLimiter implements StkRateLimiter {
  constructor(
    private readonly client: RedisLike,
    private readonly opts: RedisStoreOptions = {}
  ) {}

  private k(key: string, windowSeconds: number): string {
    const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
    return prefix(this.opts.keyPrefix, `rl:${windowSeconds}:${bucket}`, key);
  }

  async tryConsume(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<boolean> {
    const bucketKey = this.k(key, windowSeconds);
    const count = await this.client.incr(bucketKey);
    if (count === 1) {
      await this.client.expire(bucketKey, windowSeconds);
    }
    return count <= limit;
  }
}
