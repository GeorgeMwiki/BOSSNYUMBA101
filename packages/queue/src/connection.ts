/**
 * Redis connection helpers for BullMQ queues and workers.
 *
 * Resolves a Redis connection spec from a URL or from environment variables.
 * BullMQ accepts either an ioredis Redis instance or a plain connection
 * object; we return the plain object because it is simpler to serialize
 * and works uniformly across `Queue`, `Worker`, and `QueueEvents`.
 */

export interface RedisConnection {
  host: string;
  port: number;
  password?: string;
  username?: string;
  db?: number;
  tls?: Record<string, unknown>;
}

/**
 * Parse a Redis URL (redis://, rediss://) into a BullMQ-compatible connection
 * object. Falls back to localhost:6379 in non-production environments when
 * no URL is provided. Throws in production if no REDIS_URL is present, since
 * workers without a real Redis are useless and silently falling back masks
 * misconfiguration.
 */
export function resolveRedisConnection(redisUrl?: string): RedisConnection {
  const url = redisUrl ?? process.env['REDIS_URL'];

  if (url) {
    try {
      const u = new URL(url);
      const connection: RedisConnection = {
        host: u.hostname,
        port: parseInt(u.port || '6379', 10),
      };
      if (u.password) connection.password = decodeURIComponent(u.password);
      if (u.username && u.username !== 'default') {
        connection.username = decodeURIComponent(u.username);
      }
      if (u.pathname && u.pathname.length > 1) {
        const dbNum = parseInt(u.pathname.slice(1), 10);
        if (!Number.isNaN(dbNum)) connection.db = dbNum;
      }
      if (u.protocol === 'rediss:') {
        connection.tls = {};
      }
      return connection;
    } catch {
      // invalid URL, fall through to defaults
    }
  }

  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      'REDIS_URL is required in production for BullMQ queues and workers'
    );
  }

  return { host: '127.0.0.1', port: 6379 };
}
