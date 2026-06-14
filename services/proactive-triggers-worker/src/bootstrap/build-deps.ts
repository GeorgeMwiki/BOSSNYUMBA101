/**
 * Composition root for the standalone pod.
 *
 * Builds the REAL `RunSweepDeps`:
 *   - `db`        — the api-gateway Drizzle client (shared pool config),
 *                   lazy-imported from its dist so unit tests never open
 *                   a connection. Mirrors `services/consolidation-worker/
 *                   src/index.ts`.
 *   - `directory` — `createDrizzleDirectory` over that db.
 *   - `sink`      — `createNotificationSink` (in-app inbox). This is the
 *                   PRODUCTION sink, NOT the log-only sink.
 *   - `cache`     — `InMemoryIdempotencyCache` (prod swaps for Redis at a
 *                   later wave; the interface is identical).
 *   - `staffAlertSink` — `createStaffAlertSink`, resolving operators to
 *                   the tenant's active OWNER accounts via the same db.
 *
 * Returns `null` when no `DATABASE_URL` is configured and no db was
 * injected — the supervisor then logs + exits as a no-op, exactly like
 * the consolidation-worker, instead of crashing.
 *
 * PRODUCTION FAIL-FAST (mirrors `SLEEP_PASS_PROD_ADAPTERS` in
 * `services/sleep-pass-orchestrator/src/standalone-bootstrap.ts`): a
 * degraded no-op pod must NOT be allowed to pass as healthy in
 * production. When prod adapters are REQUIRED — either
 * `PROACTIVE_TRIGGERS_PROD_ADAPTERS=1` is set, or `NODE_ENV=production` —
 * and the real db (hence the real notification sink + directory) cannot
 * be resolved, this THROWS instead of returning the silent `null` no-op.
 * That turns a misconfigured prod deploy into a crash-loop the operator
 * sees, not an idle pod that quietly generates zero proactive hints.
 */
import { sql } from 'drizzle-orm';
import { InMemoryIdempotencyCache } from '../idempotency/trigger-seen.js';
import { createDrizzleDirectory, type DrizzleLikeClient } from './drizzle-directory.js';
import { createNotificationSink } from './notification-sink.js';
import { createStaffAlertSink } from './staff-alert-sink.js';
import type { RunSweepDeps } from '../schedule/cron-handler.js';
import type { WorkerLogger } from '../types.js';

export interface BuildDepsArgs {
  /** Inject a db for tests. Production resolves it from DATABASE_URL. */
  readonly db?: DrizzleLikeClient | null;
  readonly logger?: WorkerLogger;
  readonly concurrency?: number;
  readonly minUrgency?: 1 | 2 | 3 | 4 | 5;
  readonly lookbackHours?: number;
  /**
   * Override the prod-adapters-required env read for tests. When `true`,
   * an unresolvable db THROWS instead of returning the degraded `null`
   * no-op. Production derives this from the environment (see
   * {@link prodAdaptersRequired}).
   */
  readonly requireProdAdapters?: boolean;
}

/**
 * Build the production deps bundle. Returns `null` when no db is
 * available AND prod adapters are not required (degraded no-op mode).
 *
 * THROWS when prod adapters are required (see {@link prodAdaptersRequired})
 * but the real db / sinks cannot be resolved — fail-fast so a degraded
 * pod cannot pass as healthy in production.
 */
export async function buildProductionDeps(
  args: BuildDepsArgs = {},
): Promise<RunSweepDeps | null> {
  const logger = args.logger;
  const mustHaveProd = args.requireProdAdapters ?? prodAdaptersRequired();
  const db = await resolveDb(args.db ?? null, logger);
  if (!db) {
    if (mustHaveProd) {
      throw new Error(
        'proactive-triggers-worker: production adapters are required ' +
          '(PROACTIVE_TRIGGERS_PROD_ADAPTERS=1 or NODE_ENV=production) but ' +
          'no db could be resolved — refusing to run the degraded in-memory ' +
          'no-op. Set DATABASE_URL so the real notification sink + tenant ' +
          'directory wire, or unset the prod-adapters flag for dev.',
      );
    }
    return null;
  }

  const directory = createDrizzleDirectory({
    db,
    ...(logger ? { logger } : {}),
  });
  const sink = createNotificationSink();
  const cache = new InMemoryIdempotencyCache();
  const staffAlertSink = createStaffAlertSink({
    resolveOperators: (tenantId) => listActiveOwnerIds(db, tenantId, logger),
    ...(logger ? { logger } : {}),
  });

  return {
    directory,
    sink,
    cache,
    db,
    staffAlertSink,
    ...(logger ? { logger } : {}),
    ...(args.concurrency !== undefined ? { concurrency: args.concurrency } : {}),
    ...(args.minUrgency !== undefined ? { minUrgency: args.minUrgency } : {}),
    ...(args.lookbackHours !== undefined
      ? { lookbackHours: args.lookbackHours }
      : {}),
  };
}

/**
 * Whether the standalone pod must run with REAL production adapters.
 * True when `PROACTIVE_TRIGGERS_PROD_ADAPTERS=1` is explicitly set, or
 * when `NODE_ENV=production` (a prod pod has no business silently running
 * the degraded in-memory no-op). Mirrors the `SLEEP_PASS_PROD_ADAPTERS`
 * guard semantics in the sleep-pass-orchestrator.
 */
function prodAdaptersRequired(): boolean {
  if (process.env['PROACTIVE_TRIGGERS_PROD_ADAPTERS'] === '1') return true;
  return process.env['NODE_ENV'] === 'production';
}

/**
 * Resolve the Drizzle client. Prefers an injected db; otherwise reuses
 * the api-gateway db-client so the pool config matches the platform.
 * Lazy dynamic import so unit tests never need a live DB.
 */
async function resolveDb(
  injected: DrizzleLikeClient | null,
  logger?: WorkerLogger,
): Promise<DrizzleLikeClient | null> {
  if (injected) return injected;

  const dbUrl = process.env['DATABASE_URL']?.trim();
  if (!dbUrl) {
    logger?.warn?.(
      {},
      'proactive-triggers-worker: DATABASE_URL not set — supervisor is a no-op',
    );
    return null;
  }
  try {
    const mod = (await import(
      // @ts-expect-error — sibling-service import resolved by pnpm symlink at runtime
      '../../../api-gateway/dist/composition/db-client.js'
    )) as { getDb?: () => unknown };
    const db = (mod.getDb?.() ?? null) as DrizzleLikeClient | null;
    if (!db) {
      logger?.warn?.(
        {},
        'proactive-triggers-worker: db-client returned null — supervisor is a no-op',
      );
    }
    return db;
  } catch (error) {
    logger?.warn?.(
      { err: error instanceof Error ? error.message : String(error) },
      'proactive-triggers-worker: db-client import failed — supervisor is a no-op',
    );
    return null;
  }
}

/**
 * Active OWNER user-ids for a tenant — the operators who receive the
 * dropped-trigger staff alert. Degrades to `[]` on any DB error so the
 * alert path never crashes the sweep.
 */
async function listActiveOwnerIds(
  db: DrizzleLikeClient,
  tenantId: string,
  logger?: WorkerLogger,
): Promise<ReadonlyArray<string>> {
  if (!tenantId) return [];
  try {
    const res = await db.execute(
      sql`SELECT id FROM users
          WHERE tenant_id = ${tenantId}
            AND status = 'active'
            AND is_owner = TRUE`,
    );
    const rows = Array.isArray(res)
      ? (res as ReadonlyArray<Record<string, unknown>>)
      : ((res as { rows?: ReadonlyArray<Record<string, unknown>> }).rows ?? []);
    return rows
      .map((r) => r['id'])
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch (error) {
    logger?.warn?.(
      { tenantId, err: error instanceof Error ? error.message : String(error) },
      'proactive-triggers-worker: owner lookup failed — staff alert has no recipients',
    );
    return [];
  }
}
