/**
 * Store factory: selects memory or redis-backed stores based on the
 * `MPESA_STORE_BACKEND` environment variable.
 *
 * - `MPESA_STORE_BACKEND=memory` (default): in-process stores, useful for
 *   tests and single-instance deployments.
 * - `MPESA_STORE_BACKEND=redis`: redis-backed stores. Requires `REDIS_URL`.
 *   `ioredis` is loaded lazily so that pure memory consumers don't pay the
 *   dependency cost.
 */
import { logger } from './logger';
import {
  RedisCallbackReplayStore,
  RedisStkIdempotencyStore,
  RedisStkRateLimiter,
  type RedisLike,
} from './redis-store';
import {
  __memoryImpls,
  type CallbackReplayStore,
  type StkIdempotencyStore,
  type StkRateLimiter,
} from './stores';

export interface PaymentStores {
  stkIdempotencyStore: StkIdempotencyStore;
  callbackReplayStore: CallbackReplayStore;
  stkRateLimiter: StkRateLimiter;
  /** Optional handle for graceful shutdown of the backing client. */
  close?: () => Promise<void>;
}

export type StoreBackend = 'memory' | 'redis';

export interface CreateStoresOptions {
  backend?: StoreBackend;
  redisUrl?: string;
  redisClient?: RedisLike;
  keyPrefix?: string;
}

function resolveBackend(opts: CreateStoresOptions): StoreBackend {
  if (opts.backend) return opts.backend;
  const env = (process.env.MPESA_STORE_BACKEND || 'memory').toLowerCase();
  if (env === 'redis') return 'redis';
  return 'memory';
}

function loadIoredis(): any {
  // Lazy require so memory-only consumers don't need ioredis installed.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('ioredis');
}

export function createStores(opts: CreateStoresOptions = {}): PaymentStores {
  const backend = resolveBackend(opts);

  if (backend === 'memory') {
    logger.info({ backend: 'memory' }, 'M-Pesa stores initialised');
    return {
      stkIdempotencyStore: new __memoryImpls.MemoryIdempotencyStore(),
      callbackReplayStore: new __memoryImpls.MemoryCallbackReplayStore(),
      stkRateLimiter: new __memoryImpls.MemoryStkRateLimiter(),
    };
  }

  // redis
  let client: RedisLike;
  let close: (() => Promise<void>) | undefined;

  if (opts.redisClient) {
    client = opts.redisClient;
  } else {
    const url = opts.redisUrl || process.env.REDIS_URL;
    if (!url) {
      logger.warn(
        'MPESA_STORE_BACKEND=redis set but REDIS_URL is missing; falling back to memory stores'
      );
      return createStores({ ...opts, backend: 'memory' });
    }

    try {
      const IORedis = loadIoredis();
      const RedisCtor = IORedis.default || IORedis;
      const instance = new RedisCtor(url, {
        lazyConnect: false,
        maxRetriesPerRequest: 3,
      });
      client = instance as RedisLike;
      close = async () => {
        try {
          await instance.quit();
        } catch {
          instance.disconnect?.();
        }
      };
    } catch (err) {
      logger.error(
        { err },
        'Failed to initialise ioredis client; falling back to memory stores'
      );
      return createStores({ ...opts, backend: 'memory' });
    }
  }

  logger.info({ backend: 'redis' }, 'M-Pesa stores initialised');

  return {
    stkIdempotencyStore: new RedisStkIdempotencyStore(client, {
      keyPrefix: opts.keyPrefix,
    }),
    callbackReplayStore: new RedisCallbackReplayStore(client, {
      keyPrefix: opts.keyPrefix,
    }),
    stkRateLimiter: new RedisStkRateLimiter(client, {
      keyPrefix: opts.keyPrefix,
    }),
    close,
  };
}
