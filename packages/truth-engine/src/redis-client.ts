/**
 * Redis client adapter (BossNyumba wiring)
 *
 * The ported `@/lib/redis-client` `getRedisClient()` returned an
 * Upstash-REST-style client whose `.set(key, value, ttlSeconds)` takes the TTL
 * as a third positional argument. The truth-engine rate-limiter only reaches
 * this path when `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are set
 * (see `rate-limit.ts`); otherwise it uses an in-process sliding-window
 * fallback.
 *
 * TODO(port): no BossNyumba equivalent for an Upstash REST client.
 * ----------------------------------------------------------------------------
 * BN's canonical Redis is ioredis, constructed in `services/api-gateway`
 * (`new Redis(process.env.REDIS_URL)`) via the `@bossnyumba/config`
 * `createRedisClient(IORedis, opts)` factory. That factory is NOT exported
 * across the `@bossnyumba/config` package boundary, requires the caller to
 * inject the `ioredis` constructor, and exposes ioredis' `set(key, val, 'EX',
 * seconds)` signature — which does not match the 3-arg REST shape this module
 * was written against. Wiring a real distributed limiter here would mean
 * adding `ioredis` as a dependency and reshaping the call site, which is out of
 * scope for the import-repoint pass and should be done deliberately by the
 * owner. Until then `getRedisClient()` fails loud and the rate-limiter
 * degrades to its in-memory fallback (the call site already try/catches it).
 */

/**
 * Minimal Redis surface the truth-engine rate-limiter depends on. Kept local
 * (pure types) so we don't paper over the missing client with `any`.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  /** Upstash-REST-style set with TTL seconds as the third positional arg. */
  set(key: string, value: string, ttlSeconds: number): Promise<unknown>;
}

/**
 * Returns a Redis client. Currently unwired (see TODO above): throws so the
 * caller falls back to the in-process limiter rather than silently passing
 * every request on a cold boot.
 */
export function getRedisClient(): RedisLike {
  throw new Error(
    "truth-engine: distributed Redis client not wired (no BN Upstash-REST equivalent); using in-memory rate-limit fallback",
  );
}
