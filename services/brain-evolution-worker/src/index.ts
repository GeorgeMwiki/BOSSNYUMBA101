/**
 * brain-evolution-worker — composition root + process entrypoint.
 *
 * This is the file the Dockerfile CMD (`node dist/index.js`) executes and
 * the Kubernetes CronJob fires nightly at 02:00 UTC. It mirrors the
 * sibling `services/consolidation-worker/src/index.ts`:
 *
 *   1. Read `BRAIN_EVOLUTION_INTERVAL_MS`:
 *        - `0` (the CronJob default)  → run `runNightlySweep` ONCE, exit.
 *        - `> 0`                      → run once now, then loop on a
 *                                       guarded `setInterval` (in-flight
 *                                       guard + `.unref()`), for the
 *                                       in-process / long-running deploy.
 *   2. Resolve the Drizzle client:
 *        - injected `db` (tests), else the api-gateway `getDb()` from the
 *          built sibling service (same lazy-import pattern the
 *          consolidation-worker uses so unit tests need no real DB).
 *        - Missing `DATABASE_URL` / db-client in DEV → supervisor logs +
 *          exits a clean no-op (never crash-loops on a dev environment).
 *        - Missing db in PRODUCTION (`NODE_ENV=production` or
 *          `BRAIN_EVOLUTION_PROD_ADAPTERS=1`) → FAIL-FAST throw. A degraded
 *          no-op sweep must NOT pass as a healthy nightly run; the CronJob
 *          job fails visibly so the operator sees it, mirroring the
 *          `SLEEP_PASS_PROD_ADAPTERS` guard in the sibling sleep workers.
 *   3. Build the real adapter bundle (`buildNightlySweepDeps`) and call
 *      `runNightlySweep` — which itself never throws.
 *   4. SIGTERM / SIGINT → stop the loop + `process.exit(0)`.
 *
 * The exported `main()` / `runOnce()` / `buildRunnableSweep()` helpers are
 * the live detectors the entrypoint test asserts against: they prove the
 * module builds a RUNNABLE sweep (real deps wired, callable) without a DB.
 */

import { runNightlySweep, type NightlySweepDeps } from './schedule/cron-handler.js';
import type { TenantIterationSummary } from './schedule/tenant-iteration.js';
import {
  buildNightlySweepDeps,
  type BuildDepsOverrides,
} from './composition/build-deps.js';
import type { DrizzleLikeClient } from './composition/shared.js';
import { asMessage } from './composition/shared.js';
import type { BrainWorkerLogger } from './types.js';
import { logger as defaultLogger } from './logger.js';

const DEFAULT_INTERVAL_MS = 0;

export interface MainOptions {
  /** Inject db for tests. Production resolves the api-gateway db-client. */
  readonly db?: DrizzleLikeClient | null;
  readonly logger?: BrainWorkerLogger;
  /** Override the env-read interval (ms). `0` = run-once. */
  readonly intervalMs?: number;
  /** Port overrides — the api-gateway composition root injects the LLM jury. */
  readonly overrides?: BuildDepsOverrides;
  /**
   * Override the prod-adapters-required env read (tests). When `true` and
   * no db can be resolved, `main` THROWS instead of exiting a silent no-op.
   * Production derives this from the environment — see
   * {@link prodAdaptersRequired}.
   */
  readonly requireProdAdapters?: boolean;
}

/**
 * Assemble the runnable sweep: resolve real adapters over `db` and return
 * a thunk that runs one nightly sweep. Pure wiring — no I/O until the
 * returned function is called. This is the unit the entrypoint test
 * exercises to prove the composition root builds a runnable sweep.
 */
export function buildRunnableSweep(args: {
  readonly db: DrizzleLikeClient;
  readonly logger: BrainWorkerLogger;
  readonly overrides?: BuildDepsOverrides;
}): {
  readonly deps: NightlySweepDeps;
  readonly run: () => Promise<TenantIterationSummary>;
} {
  const deps = buildNightlySweepDeps({
    db: args.db,
    logger: args.logger,
    ...(args.overrides ? { overrides: args.overrides } : {}),
  });
  return {
    deps,
    run: () => runNightlySweep(deps),
  };
}

/**
 * Run exactly one nightly sweep against `db`. Returns the summary so the
 * CronJob path can log the aggregate. Never throws — `runNightlySweep`
 * absorbs per-tenant errors internally.
 */
export async function runOnce(args: {
  readonly db: DrizzleLikeClient;
  readonly logger: BrainWorkerLogger;
  readonly overrides?: BuildDepsOverrides;
}): Promise<TenantIterationSummary> {
  const { run } = buildRunnableSweep(args);
  return run();
}

/**
 * Process entrypoint. Env-driven boot, SIGTERM-safe shutdown.
 */
export async function main(options: MainOptions = {}): Promise<void> {
  const logger = options.logger ?? defaultLogger;
  const intervalMs = resolveInterval(options.intervalMs);

  const mustHaveProd = options.requireProdAdapters ?? prodAdaptersRequired();
  const db = await resolveDb(options.db ?? null, logger);
  if (!db) {
    // PRODUCTION FAIL-FAST (mirrors `SLEEP_PASS_PROD_ADAPTERS` /
    // `proactive-triggers-worker`'s `buildProductionDeps`): a degraded
    // no-op sweep must NOT pass as a healthy nightly run in production. If
    // the real db (hence the real memory writer + report sink) cannot be
    // resolved while prod adapters are REQUIRED, THROW so the CronJob job
    // fails visibly (the operator sees the failed run + alert) instead of
    // exiting 0 with brain self-improvement silently absent.
    if (mustHaveProd) {
      throw new Error(
        'brain-evolution-worker: production adapters are required ' +
          '(BRAIN_EVOLUTION_PROD_ADAPTERS=1 or NODE_ENV=production) but no ' +
          'db could be resolved — refusing to run the degraded no-op sweep. ' +
          'Set DATABASE_URL so the real memory-writer + report-sink + tenant ' +
          'directory wire, or unset the prod-adapters flag for dev.',
      );
    }
    // resolveDb already logged the reason. Clean no-op exit — NOT a crash.
    return;
  }

  const sweepArgs = {
    db,
    logger,
    ...(options.overrides ? { overrides: options.overrides } : {}),
  };

  // Run-once mode (CronJob default): one sweep, then return so the
  // process exits 0. No interval, no lingering handles.
  if (intervalMs <= 0) {
    const summary = await runOnce(sweepArgs);
    logSummary(logger, summary);
    return;
  }

  // Long-running mode: run once immediately, then on a guarded interval.
  await runGuardedOnce(sweepArgs, logger);

  let inFlight = false;
  const timer = setInterval(() => {
    if (inFlight) {
      logger.warn?.({}, 'brain-evolution-worker: previous sweep still running — skipping tick');
      return;
    }
    inFlight = true;
    void runGuardedOnce(sweepArgs, logger).finally(() => {
      inFlight = false;
    });
  }, intervalMs);
  // Never keep the event loop alive on the timer alone — a SIGTERM during
  // an idle interval exits promptly.
  timer.unref();

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'brain-evolution-worker: shutdown requested');
    clearInterval(timer);
    setTimeout(() => process.exit(0), 50).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

async function runGuardedOnce(
  args: { db: DrizzleLikeClient; logger: BrainWorkerLogger; overrides?: BuildDepsOverrides },
  logger: BrainWorkerLogger,
): Promise<void> {
  try {
    const summary = await runOnce(args);
    logSummary(logger, summary);
  } catch (error) {
    // runNightlySweep should never throw, but the guard keeps the loop
    // alive even if a composition-level error escapes.
    logger.error?.(
      { err: asMessage(error) },
      'brain-evolution-worker: sweep tick threw — loop continues',
    );
  }
}

function resolveInterval(override: number | undefined): number {
  if (typeof override === 'number' && Number.isFinite(override)) {
    return Math.max(0, Math.floor(override));
  }
  const raw = Number(process.env.BRAIN_EVOLUTION_INTERVAL_MS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_INTERVAL_MS;
}

/**
 * Whether the nightly sweep must run with REAL production adapters. True
 * when `BRAIN_EVOLUTION_PROD_ADAPTERS=1` is explicitly set, or when
 * `NODE_ENV=production` (the CronJob runs with `NODE_ENV=production`, and a
 * prod job has no business silently exiting 0 as a degraded no-op). Mirrors
 * the `SLEEP_PASS_PROD_ADAPTERS` guard semantics used by the sibling
 * sleep-time workers (`proactive-triggers-worker`, `sleep-pass-orchestrator`).
 */
function prodAdaptersRequired(): boolean {
  if (process.env.BRAIN_EVOLUTION_PROD_ADAPTERS === '1') return true;
  return process.env.NODE_ENV === 'production';
}

/**
 * Resolve the Drizzle client. Injected `db` wins (tests). Otherwise the
 * api-gateway `getDb()` is lazy-imported from the built sibling service so
 * the connection-pool config matches the rest of the platform and unit
 * tests never need a real DB. A missing `DATABASE_URL` / db-client is a
 * clean no-op (logged), NOT a crash — that is what keeps the nightly
 * CronJob from crash-looping in a degraded environment.
 */
async function resolveDb(
  injected: DrizzleLikeClient | null,
  logger: BrainWorkerLogger,
): Promise<DrizzleLikeClient | null> {
  if (injected) return injected;

  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    logger.warn?.({}, 'brain-evolution-worker: DATABASE_URL not set — sweep is a no-op');
    return null;
  }

  try {
    const mod = (await import(
      // @ts-expect-error — sibling-service import resolved by pnpm symlink at runtime
      '../../api-gateway/dist/composition/db-client.js'
    )) as { getDb?: () => unknown };
    const db = (mod.getDb?.() ?? null) as DrizzleLikeClient | null;
    if (!db) {
      logger.warn?.({}, 'brain-evolution-worker: db-client returned null — sweep is a no-op');
      return null;
    }
    return db;
  } catch (error) {
    logger.warn?.(
      { err: asMessage(error) },
      'brain-evolution-worker: db-client import failed — sweep is a no-op',
    );
    return null;
  }
}

function logSummary(logger: BrainWorkerLogger, summary: TenantIterationSummary): void {
  logger.info(
    {
      totalTenants: summary.totalTenants,
      ok: summary.ok,
      skipped: summary.skipped,
      errored: summary.errored,
      deltasApplied: summary.totalDeltasApplied,
      deltasEscalated: summary.totalDeltasEscalated,
      deltasBlocked: summary.totalDeltasBlocked,
    },
    'brain-evolution-worker: nightly sweep complete',
  );
}

// ─────────────────────────────────────────────────────────────────────
// CLI guard — only run main() when this file is the program entry, so
// importing it in tests never boots the worker.
// ─────────────────────────────────────────────────────────────────────

const isDirect =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === 'string' &&
  /index(\.js|\.ts)?$/.test(process.argv[1]) &&
  process.argv[1].includes('brain-evolution-worker');

if (isDirect) {
  main().catch((error) => {
    defaultLogger.error?.({ err: asMessage(error) }, 'brain-evolution-worker: fatal');
    process.exit(2);
  });
}
