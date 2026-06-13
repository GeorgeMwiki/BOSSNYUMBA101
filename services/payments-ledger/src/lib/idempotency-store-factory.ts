/**
 * Selects the durable webhook idempotency store (M3) following the same
 * fail-loud-in-prod discipline as the repository factory:
 *
 *   1. Redis client present (REDIS_URL set) → Redis `SET NX EX`. Shared
 *      across replicas; the preferred production store.
 *   2. else DB client present → Postgres unique index.
 *   3. else in production → THROW. A process-local Map in production is
 *      exactly the double-credit-across-replicas bug we are closing; we
 *      refuse to start rather than degrade silently.
 *   4. else (dev/test) → in-memory fallback.
 */
import type { DatabaseClient } from '@bossnyumba/database';
import {
  createInMemoryDurableIdempotencyStore,
  createPostgresIdempotencyStore,
  createRedisIdempotencyStore,
  type DurableIdempotencyStore,
  type RedisLike,
} from './idempotency-store';

export interface IdempotencyStoreFactoryDeps {
  /** Redis client (ioredis-compatible) or null when REDIS_URL is unset. */
  redis: RedisLike | null;
  /** Drizzle client or null when DATABASE_URL is unset / init failed. */
  db: DatabaseClient | null;
  isProduction: boolean;
  logger: {
    warn: (obj: object, msg: string) => void;
    info?: (obj: object, msg: string) => void;
  };
}

export type IdempotencyStoreKind = 'redis' | 'postgres' | 'in-memory';

export interface SelectedIdempotencyStore {
  store: DurableIdempotencyStore;
  kind: IdempotencyStoreKind;
}

/**
 * Build an ioredis client from REDIS_URL for the idempotency store, or
 * return null when the URL is unset. Kept here so the ioredis import is
 * contained to one module and the composition root stays declarative.
 *
 * `lazyConnect` so constructing the client never blocks startup; the
 * first `SET`/`DEL` connects. A failure to connect surfaces on the
 * webhook path (logged, retried) rather than crashing the pod.
 */
export function createRedisFromUrl(
  redisUrl: string | undefined,
  logger: IdempotencyStoreFactoryDeps['logger'],
): RedisLike | null {
  if (!redisUrl) return null;
  try {
    const IORedis = require('ioredis') as {
      default?: new (url: string, opts?: object) => RedisLike;
      new (url: string, opts?: object): RedisLike;
    };
    const Ctor = IORedis.default ?? IORedis;
    return new Ctor(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'webhook idempotency: failed to construct Redis client from REDIS_URL',
    );
    return null;
  }
}

export function selectWebhookIdempotencyStore(
  deps: IdempotencyStoreFactoryDeps,
): SelectedIdempotencyStore {
  if (deps.redis) {
    deps.logger.info?.({ store: 'redis' }, 'webhook idempotency: using Redis (SET NX EX)');
    return { store: createRedisIdempotencyStore(deps.redis), kind: 'redis' };
  }

  if (deps.db) {
    deps.logger.info?.(
      { store: 'postgres' },
      'webhook idempotency: using Postgres unique index',
    );
    return { store: createPostgresIdempotencyStore(deps.db), kind: 'postgres' };
  }

  if (deps.isProduction) {
    deps.logger.warn(
      { store: 'none', reason: 'no_redis_no_db' },
      'webhook idempotency: refusing to start with a process-local dedup store in production',
    );
    throw new Error(
      'Cannot start payments-ledger: no durable idempotency store (set REDIS_URL or DATABASE_URL). ' +
        'A process-local dedup store double-credits across replicas/restarts.',
    );
  }

  deps.logger.warn(
    { store: 'in-memory', reason: 'dev_or_test_fallback' },
    'webhook idempotency: using in-memory store (NOT durable — dev/test only)',
  );
  return { store: createInMemoryDurableIdempotencyStore(), kind: 'in-memory' };
}
