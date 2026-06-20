/**
 * Composition root for the outcomes-metering pod.
 *
 * This is the file the process entrypoint (`index.ts main()`) calls to
 * assemble a PRODUCTION-wired app:
 *
 *   1. Resolve the Drizzle client — injected `db` (tests) else the
 *      api-gateway `getDb()` lazy-imported from the built sibling
 *      service (same pattern the brain-evolution-worker /
 *      consolidation-worker use, so unit tests never open a connection).
 *   2. Build the REAL `createDrizzleBillingStore` over that client,
 *      bound to `outcome_events` / `outcome_billing_lines`
 *      (migration 0169) — replacing the volatile in-memory store.
 *   3. Build a `ReadinessDbPool` over the client so `/readyz` pings the
 *      live DB (`SELECT 1`).
 *   4. Wire a real `BrainEventBus` subscriber so the consumer is NOT
 *      born-dark: an injected bus (the shared instance from the
 *      api-gateway composition root, which hosts the publishers) wins;
 *      otherwise a process-local in-memory bus is constructed so a
 *      standalone pod still subscribes (and a local publisher / replay
 *      tool can drive it).
 *
 * PRODUCTION FAIL-FAST (mirrors `SLEEP_PASS_PROD_ADAPTERS`): when prod
 * adapters are REQUIRED (`OUTCOMES_METERING_PROD_ADAPTERS=1` or
 * `NODE_ENV=production`) and no DB can be resolved, this THROWS rather
 * than falling back to the in-memory store. A money-path service must
 * NOT silently run a volatile, per-replica billing store in production
 * (finding BORN-DARK + FAKE-PERSISTENCE). Combined with the `/readyz`
 * born-dark guard, a misconfigured prod deploy crash-loops visibly
 * instead of dropping revenue silently.
 */

import {
  createInMemoryBrainEventBus,
  type BrainEventSubscriber,
} from '@bossnyumba/ai-copilot/brain-event-bus';
import { sql } from 'drizzle-orm';
import { buildApp, type BuildAppResult } from '../index.js';
import {
  createDrizzleBillingStore,
  type DrizzleBillingClient,
} from '../store/drizzle-billing-store.js';
import type { ReadinessDbPool } from '../routes/readyz.js';
import { prodAdaptersRequired } from '../routes/readyz.js';
import type { ConsumerLogger } from '../consumers/brain-event-consumer.js';
import { logger as defaultLogger } from '../logger.js';

export interface BuildProductionAppOptions {
  /** Inject a Drizzle client for tests. Production resolves `getDb()`. */
  readonly db?: DrizzleBillingClient | null;
  /**
   * Inject the shared brain-event-bus (the api-gateway composition root
   * passes its singleton so this consumer subscribes to the SAME bus the
   * publishers emit on). When omitted, a process-local in-memory bus is
   * constructed.
   */
  readonly bus?: BrainEventSubscriber;
  readonly logger?: ConsumerLogger;
  /**
   * Override the prod-adapters-required env read (tests). When `true`
   * and no db resolves, `buildProductionApp` THROWS. Production derives
   * this from the environment.
   */
  readonly requireProdAdapters?: boolean;
}

/**
 * Assemble the production app: real Drizzle store, DB-backed readiness,
 * wired bus consumer. THROWS when prod adapters are required but no db
 * can be resolved.
 */
export async function buildProductionApp(
  options: BuildProductionAppOptions = {},
): Promise<BuildAppResult> {
  const logger = options.logger ?? toConsumerLogger();
  const mustHaveProd = options.requireProdAdapters ?? prodAdaptersRequired();

  const db = await resolveDb(options.db ?? null, logger);
  if (!db) {
    if (mustHaveProd) {
      throw new Error(
        'outcomes-metering: production adapters are required ' +
          '(OUTCOMES_METERING_PROD_ADAPTERS=1 or NODE_ENV=production) but no ' +
          'db could be resolved — refusing to run the volatile in-memory ' +
          'billing store. Set DATABASE_URL so the Drizzle store + DB-backed ' +
          'readiness wire, or unset the prod-adapters flag for dev.',
      );
    }
    // Dev/test — fall back to the in-memory store via the default
    // buildApp path. A process-local bus still wires the consumer so the
    // service is not born-dark even in dev.
    return buildApp({
      bus: options.bus ?? createInMemoryBrainEventBus(),
      ...(options.logger ? { logger: options.logger } : {}),
      requireProdAdapters: false,
    });
  }

  const store = createDrizzleBillingStore({ db });
  const dbPool = toReadinessPool(db);
  const bus = options.bus ?? createInMemoryBrainEventBus();

  return buildApp({
    store,
    bus,
    dbPool,
    ...(options.logger ? { logger: options.logger } : {}),
    ...(options.requireProdAdapters !== undefined
      ? { requireProdAdapters: options.requireProdAdapters }
      : {}),
  });
}

/**
 * Resolve the Drizzle client. Injected `db` wins (tests). Otherwise the
 * api-gateway `getDb()` is lazy-imported from the built sibling service
 * so the pool config matches the platform and unit tests need no real
 * DB. A missing `DATABASE_URL` / db-client returns null (logged) — the
 * caller decides whether that is fatal.
 */
async function resolveDb(
  injected: DrizzleBillingClient | null,
  logger: ConsumerLogger,
): Promise<DrizzleBillingClient | null> {
  if (injected) return injected;

  const dbUrl = process.env['DATABASE_URL']?.trim();
  if (!dbUrl) {
    logger.warn?.({}, 'outcomes-metering: DATABASE_URL not set — no DB store');
    return null;
  }

  try {
    const mod = (await import(
      // @ts-expect-error — sibling-service import resolved by pnpm symlink at runtime
      '../../../api-gateway/dist/composition/db-client.js'
    )) as { getDb?: () => unknown };
    const db = (mod.getDb?.() ?? null) as DrizzleBillingClient | null;
    if (!db) {
      logger.warn?.({}, 'outcomes-metering: db-client returned null — no DB store');
      return null;
    }
    return db;
  } catch (error) {
    logger.warn?.(
      { err: error instanceof Error ? error.message : String(error) },
      'outcomes-metering: db-client import failed — no DB store',
    );
    return null;
  }
}

/**
 * Adapt the Drizzle client to the `ReadinessDbPool` shape `/readyz`
 * expects (`query(sql: string)`), issuing the ping via `db.execute`.
 */
export function toReadinessPool(db: DrizzleBillingClient): ReadinessDbPool {
  return {
    query: async () => db.execute(sql`SELECT 1`),
  };
}

/** Bridge the module logger into the `ConsumerLogger` (obj, msg) shape. */
function toConsumerLogger(): ConsumerLogger {
  return {
    info: (meta, msg) => defaultLogger.info(msg, meta as Record<string, unknown>),
    warn: (meta, msg) => defaultLogger.warn(msg, meta as Record<string, unknown>),
    error: (meta, msg) => defaultLogger.error(msg, meta as Record<string, unknown>),
  };
}
