/**
 * Store Factory
 *
 * Picks between in-memory and Redis-backed stores based on the
 * `MPESA_STORE_BACKEND` env var. Default: 'memory'. Set to 'redis'
 * for multi-pod production deployments.
 *
 * When `redis` is selected, reads `REDIS_URL` (default:
 * 'redis://localhost:6379') and lazily creates a single shared ioredis
 * client for all three stores.
 *
 * Usage:
 *   import { createStores } from './store-factory';
 *   const { idempotency, replay, rateLimiter } = createStores();
 *   setStkIdempotencyStore(idempotency);
 *   setCallbackReplayStore(replay);
 *   setStkRateLimiter(rateLimiter);
 */

import { InMemoryIdempotencyStore } from './idempotency';
import { InMemoryReplayStore } from './replay-store';
import { FixedWindowRateLimiter } from './rate-limit';
import {
  RedisIdempotencyStore,
  RedisReplayStore,
  RedisRateLimiter,
  type RedisClientLike,
} from './redis-store';
import type { IdempotencyStore } from './idempotency';
import type { ReplayStore } from './replay-store';
import type { RateLimiter } from './rate-limit';

export type StoreBackend = 'memory' | 'redis';

export interface StoreBundle {
  idempotency: IdempotencyStore<any>;
  replay: ReplayStore;
  rateLimiter: RateLimiter;
  backend: StoreBackend;
}

let cachedRedisClient: RedisClientLike | null = null;

function getRedisClient(): RedisClientLike {
  if (cachedRedisClient) return cachedRedisClient;

  // Dynamic import so ioredis is only required when MPESA_STORE_BACKEND=redis.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let Redis: any;
  try {
    Redis = require('ioredis');
  } catch {
    throw new Error(
      'MPESA_STORE_BACKEND is set to "redis" but ioredis is not installed. ' +
      'Run `pnpm add ioredis` in services/payments/',
    );
  }

  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  cachedRedisClient = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  }) as unknown as RedisClientLike;

  return cachedRedisClient;
}

/**
 * Create the store bundle. Call once at service boot, then wire the
 * returned stores into the M-Pesa STK-push + callback handlers via
 * the module-level setters.
 */
export function createStores(): StoreBundle {
  const backend = (process.env.MPESA_STORE_BACKEND || 'memory').toLowerCase() as StoreBackend;

  if (backend === 'redis') {
    const redis = getRedisClient();
    return {
      idempotency: new RedisIdempotencyStore(redis),
      replay: new RedisReplayStore(redis),
      rateLimiter: new RedisRateLimiter(
        redis,
        parseInt(process.env.MPESA_STK_RATE_LIMIT || '10', 10),
        parseInt(process.env.MPESA_STK_RATE_WINDOW_MS || '60000', 10),
      ),
      backend: 'redis',
    };
  }

  // Default: in-memory (single-instance only)
  return {
    idempotency: new InMemoryIdempotencyStore(),
    replay: new InMemoryReplayStore(),
    rateLimiter: new FixedWindowRateLimiter(),
    backend: 'memory',
  };
}
