/**
 * Singleton Drizzle client accessor.
 *
 * Reads DATABASE_URL from the environment and memoizes a single
 * postgres-js-backed Drizzle client. Callers must guard against the
 * null return — when DATABASE_URL is unset we do not initialize a
 * client; this lets the api-gateway boot in environments without a
 * Postgres reachable (tests, local dev smoke).
 *
 * This module is intentionally separate from ../middleware/database.ts
 * which serves the request-scoped hono middleware. They share the same
 * underlying client lazily via getDb() below so we never open two
 * connection pools in the same process.
 */

import { createDatabaseClient } from '@bossnyumba/database';

// NOTE: we deliberately avoid importing the named `DatabaseClient` type
// from `@bossnyumba/database` because its name collides with a namespace
// that drizzle-orm/postgres-js's declaration merging pulls in at this
// consumption site. Deriving the type via ReturnType sidesteps that.
type DrizzleClient = ReturnType<typeof createDatabaseClient>;

let cachedClient: DrizzleClient | null = null;
let initialized = false;

/**
 * Return the memoized Drizzle client, initializing it on first call.
 * Returns null when DATABASE_URL is not configured — composition root
 * decides how to handle that (typically: skip service registration and
 * let individual routes return 503).
 */
export function getDb(): DrizzleClient | null {
  if (initialized) return cachedClient;
  initialized = true;

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    cachedClient = null;
    return null;
  }

  try {
    cachedClient = createDatabaseClient(url);
    return cachedClient;
  } catch (error) {
    // Leave cachedClient null so callers fall back to degraded mode.
    // A production deployment must have DATABASE_URL set; lower envs
    // may not. Error is surfaced to the caller to log.
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`db-client: failed to initialize Drizzle client: ${message}`);
  }
}

/** Test-only: reset the memo so unit tests can swap env. */
export function __resetDbClientForTests(): void {
  cachedClient = null;
  initialized = false;
}
