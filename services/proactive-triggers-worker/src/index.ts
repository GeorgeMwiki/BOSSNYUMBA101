/**
 * Proactive Triggers Worker — entrypoint.
 *
 * Env-driven launch shape:
 *   - PROACTIVE_TRIGGERS_INTERVAL_MS — when >0, runs the sweep on a
 *     repeating timer (default 3600000 = 1 hour). When 0, runs once
 *     and exits — that's the Kubernetes CronJob mode.
 *   - PROACTIVE_TRIGGERS_CONCURRENCY — per-sweep tenant concurrency
 *     (default 4).
 *   - PROACTIVE_TRIGGERS_MIN_URGENCY — minimum urgency to fire (1..5,
 *     default 4).
 *   - PROACTIVE_TRIGGERS_LOOKBACK_HOURS — idempotency window
 *     (default 24).
 *   - PROACTIVE_TRIGGERS_PROD_ADAPTERS — '1' refuses the degraded
 *     in-memory no-op (prod fail-fast). Also implied by
 *     NODE_ENV=production. See bootstrap/build-deps.ts.
 *
 * The composition root wires real `directory`, `db`, and `sink`
 * implementations and passes them in. This module exports the
 * machinery the root needs.
 */
import { pathToFileURL } from 'node:url';
import { runHourlySweep, type RunSweepDeps } from './schedule/cron-handler.js';
import { InMemoryIdempotencyCache } from './idempotency/trigger-seen.js';
import { createLogSink } from './sinks/log-sink.js';
import { buildProductionDeps } from './bootstrap/build-deps.js';
import { logger as bootstrapLogger } from './logger.js';
import type { SweepSummary, WorkerLogger } from './types.js';

export type { SweepSummary, RunSweepDeps };
export { runHourlySweep };
export { iterateTenants } from './schedule/tenant-iteration.js';
export { InMemoryIdempotencyCache };
export { createLogSink };
export { buildProductionDeps };
export { createDrizzleDirectory } from './bootstrap/drizzle-directory.js';
export { createNotificationSink } from './bootstrap/notification-sink.js';
export { createStaffAlertSink } from './bootstrap/staff-alert-sink.js';
export type {
  ActiveUser,
  IdempotencyCache,
  StaffAlertSink,
  TenantDirectory,
  TenantSweepResult,
  TriggerSink,
  WorkerLogger,
} from './types.js';

/**
 * Launch shape — long-running loop OR single-shot. Returns the running
 * timer handle (when interval > 0) or `null` (one-shot). Consumer is
 * responsible for clearing the timer on shutdown.
 */
export interface LaunchArgs {
  readonly deps: RunSweepDeps;
  readonly intervalMs?: number;
  readonly onSweepComplete?: (summary: SweepSummary) => void;
}

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Start the worker. Returns the interval handle when looping; null
 * when running one-shot. The first sweep always runs immediately.
 */
export async function launchProactiveTriggersWorker(
  args: LaunchArgs,
): Promise<{ handle: ReturnType<typeof setInterval> | null }> {
  const intervalMs = args.intervalMs ?? envInterval();
  const logger: WorkerLogger | undefined = args.deps.logger;

  logger?.info?.(
    { intervalMs },
    intervalMs === 0
      ? 'proactive-triggers-worker: one-shot mode'
      : 'proactive-triggers-worker: starting hourly loop',
  );

  // Run once immediately.
  const summary = await runHourlySweep(args.deps);
  args.onSweepComplete?.(summary);
  logger?.info?.(
    {
      tenantsProcessed: summary.tenantsProcessed,
      triggersFired: summary.triggersFired,
      suppressedIdempotent: summary.triggersSuppressedIdempotent,
      suppressedLowUrgency: summary.triggersSuppressedLowUrgency,
    },
    'proactive-triggers-worker: sweep complete',
  );

  if (intervalMs <= 0) {
    return { handle: null };
  }

  const handle = setInterval(() => {
    runHourlySweep(args.deps)
      .then((s) => {
        args.onSweepComplete?.(s);
        logger?.info?.(
          {
            tenantsProcessed: s.tenantsProcessed,
            triggersFired: s.triggersFired,
          },
          'proactive-triggers-worker: sweep complete',
        );
      })
      .catch((err: unknown) => {
        logger?.warn?.(
          { err: err instanceof Error ? err.message : String(err) },
          'proactive-triggers-worker: sweep failed catastrophically',
        );
      });
  }, intervalMs);

  return { handle };
}

function envInterval(): number {
  const raw = process.env['PROACTIVE_TRIGGERS_INTERVAL_MS'];
  if (raw === undefined) return DEFAULT_INTERVAL_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_INTERVAL_MS;
}

function envConcurrency(): number | undefined {
  const raw = process.env['PROACTIVE_TRIGGERS_CONCURRENCY'];
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

function envMinUrgency(): (1 | 2 | 3 | 4 | 5) | undefined {
  const raw = process.env['PROACTIVE_TRIGGERS_MIN_URGENCY'];
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) return undefined;
  return n as 1 | 2 | 3 | 4 | 5;
}

function envLookbackHours(): number | undefined {
  const raw = process.env['PROACTIVE_TRIGGERS_LOOKBACK_HOURS'];
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// ---------------------------------------------------------------------------
// Standalone entrypoint — only runs when invoked directly (`node dist/
// index.js`). Mirrors `services/sleep-pass-orchestrator/src/index.ts` and
// `services/consolidation-worker/src/index.ts`: build the REAL deps,
// launch the worker, keep the process alive on the loop / exit on the
// one-shot, and shut down cleanly on SIGTERM/SIGINT.
// ---------------------------------------------------------------------------

export interface MainOptions {
  /** Inject deps for tests. Production builds them from the environment. */
  readonly deps?: RunSweepDeps;
  /** Override the launch interval. Production reads the env. */
  readonly intervalMs?: number;
  readonly logger?: WorkerLogger;
}

/**
 * Standalone supervisor. Returns the launch handle (interval handle when
 * looping; `null` for one-shot) so tests can assert ≥1 sweep ran without
 * leaking a timer. When `deps` cannot be built (no DATABASE_URL), logs +
 * returns `null` as a benign no-op instead of crashing the pod.
 */
export async function main(
  options: MainOptions = {},
): Promise<{ handle: ReturnType<typeof setInterval> | null }> {
  const logger = options.logger ?? bootstrapLogger;
  const intervalMs = options.intervalMs ?? envInterval();

  const deps =
    options.deps ??
    (await buildProductionDeps({
      logger,
      ...(envConcurrency() !== undefined ? { concurrency: envConcurrency() } : {}),
      ...(envMinUrgency() !== undefined ? { minUrgency: envMinUrgency() } : {}),
      ...(envLookbackHours() !== undefined
        ? { lookbackHours: envLookbackHours() }
        : {}),
    }));

  if (!deps) {
    // Dev / CronJob-without-DB benign no-op. In production
    // `buildProductionDeps` would have THROWN (prod-adapters fail-fast)
    // rather than return null, so reaching here means prod adapters were
    // not required — safe to idle.
    logger.warn?.(
      {},
      'proactive-triggers-worker: no deps (DATABASE_URL unset?) — supervisor is a no-op',
    );
    return { handle: null };
  }

  const { handle } = await launchProactiveTriggersWorker({ deps, intervalMs });

  if (handle === null) {
    // One-shot (CronJob) mode — the sweep already ran; nothing keeps the
    // event loop alive, so the process exits naturally.
    logger.info?.({}, 'proactive-triggers-worker: one-shot sweep done — exiting');
    return { handle: null };
  }

  // Loop mode — install signal handlers so K8s can drain us cleanly. The
  // interval handle keeps the event loop alive.
  installSignalHandlers(handle, logger);
  return { handle };
}

function installSignalHandlers(
  handle: ReturnType<typeof setInterval>,
  logger: WorkerLogger,
): void {
  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info?.({ signal }, 'proactive-triggers-worker: shutdown requested');
    clearInterval(handle);
    setTimeout(() => process.exit(0), 50).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Detect "run as CLI" robustly. Comparing `file://${argv[1]}` directly
// breaks on paths with spaces (`import.meta.url` percent-encodes them;
// argv does not), so route both through `pathToFileURL` — exactly like
// `services/sleep-pass-orchestrator/src/index.ts`.
const invokedDirectly = (() => {
  if (typeof process === 'undefined' || !Array.isArray(process.argv)) {
    return false;
  }
  const entry = process.argv[1];
  if (typeof entry !== 'string' || entry.length === 0) {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  void main().catch((err) => {
    bootstrapLogger.error?.(
      { err: err instanceof Error ? err.message : String(err) },
      'proactive-triggers-worker: fatal',
    );
    process.exit(1);
  });
}
