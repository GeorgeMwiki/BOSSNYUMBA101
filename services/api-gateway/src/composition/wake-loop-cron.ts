/**
 * Wake-loop cron — scheduled invoker for the kernel agency wake-loop.
 *
 * LITFIN parity gap H (`.planning/parity-litfin/07-agency.md`):
 *   BOSSNYUMBA built the wake-loop primitive (`agency/initiative/
 *   wake-loop.ts:66-141`) AND the three real detectors (`agency/
 *   initiative/real-detectors.ts:1-321`), but `runWakeCycle` is never
 *   invoked outside kernel-internal callers + tests. The brain cannot
 *   wake itself on schedule. This module closes that gap.
 *
 * Design:
 *
 *   - One supervisor per gateway process. `.start()` arms a setInterval
 *     timer (`WAKE_LOOP_INTERVAL_MS`, default 15 minutes) that calls
 *     `tick()` immediately and then on the cadence. `.stop()` clears
 *     the timer.
 *
 *   - Each `tick()` takes a Postgres SESSION-LEVEL advisory lock keyed
 *     by `pg_try_advisory_lock(WAKE_LOCK_ID)`. If the lock is held by
 *     another gateway replica (or another tick on the same replica
 *     that overran the cadence) the tick exits as a no-op. This
 *     guarantees at-most-one wake cycle in flight cluster-wide.
 *
 *   - Inside the lock we discover active tenants (SELECT id FROM
 *     tenants WHERE is_active = TRUE), build the wake-loop deps from
 *     the existing agency-port-bindings, and call `runWakeCycle({
 *     tenantIds })`. Trigger / executor failures are absorbed by the
 *     wake-loop itself; this supervisor only logs the aggregate
 *     outcome (`goalsOpened` + `goalsExecuted` + `perTrigger`).
 *
 *   - When DATABASE_URL is unset the supervisor is a benign no-op: it
 *     logs and returns. This matches the consolidation-runner
 *     pattern — a misconfigured cron must never crash the gateway.
 *
 * Property-management cadence tailoring:
 *
 *   The default 15-minute cadence is tuned for property-management
 *   horizons: arrears chase (14d), maintenance (7d), lease renewal
 *   (30d). A faster cadence wastes detector queries; slower delays
 *   the first arrears reminder by up to an hour. Operators can override
 *   via `WAKE_LOOP_INTERVAL_MS` for higher-frequency tests.
 */

import { sql } from 'drizzle-orm';
import { agency as agencyKernel } from '@bossnyumba/central-intelligence';
import {
  createKernelGoalsService,
  createKernelActionAuditService,
} from '@bossnyumba/database';
import {
  createBoundActionToolDeps,
  createBoundWakeReadDeps,
} from './agency-port-bindings.js';

/**
 * Stable cluster-wide lock id (BIGINT). Picked from sha256("bossnyumba-
 * wake-loop") sliced into the safe BIGINT range. Constant — every
 * replica acquires the same lock so only one cycle runs at a time.
 */
const WAKE_LOCK_ID = 7321946218472901;

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const MIN_INTERVAL_MS = 30 * 1000;
const MAX_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface WakeLoopCronLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error?(obj: Record<string, unknown>, msg?: string): void;
}

// Drizzle client shape — only `execute` is touched at this level. The
// agency-port-bindings already exhaust the typed Drizzle surface; here
// we just probe for tenants and own the advisory lock dance.
interface DrizzleLikeClient {
  execute(q: unknown): Promise<unknown>;
}

export interface WakeLoopCronDeps {
  /** Drizzle client. May be null — supervisor degrades to no-op. */
  readonly db: unknown | null;
  readonly logger: WakeLoopCronLogger;
  /** Override cadence (ms). Falls back to env `WAKE_LOOP_INTERVAL_MS`,
   *  then to 15 minutes. Bounded to [30s, 24h]. */
  readonly intervalMs?: number;
  /** Override the active-tenant discovery (tests). */
  readonly listActiveTenantIds?: () => Promise<ReadonlyArray<string>>;
}

export interface WakeLoopCronSupervisor {
  start(): void;
  stop(): void;
  /** Run one cycle immediately, bypassing the cadence. Returns the
   *  wake-loop outcome (or null when the lock was held / DB absent). */
  tick(): Promise<WakeLoopCronTickResult | null>;
  readonly intervalMs: number;
}

export interface WakeLoopCronTickResult {
  readonly tenantsProcessed: number;
  readonly goalsOpened: number;
  readonly goalsExecuted: number;
  readonly perTrigger: Record<string, number>;
  readonly skippedReason: 'lock-held' | 'no-db' | 'no-tenants' | null;
}

function resolveIntervalMs(override?: number): number {
  const envRaw = process.env.WAKE_LOOP_INTERVAL_MS?.trim();
  const envNum = envRaw ? Number(envRaw) : NaN;
  const candidate =
    typeof override === 'number' && Number.isFinite(override) && override > 0
      ? override
      : Number.isFinite(envNum) && envNum > 0
        ? envNum
        : DEFAULT_INTERVAL_MS;
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, Math.floor(candidate)));
}

async function tryAdvisoryLock(db: DrizzleLikeClient): Promise<boolean> {
  try {
    const result = (await db.execute(
      sql`SELECT pg_try_advisory_lock(${WAKE_LOCK_ID}) AS acquired`,
    )) as unknown;
    const rows = Array.isArray(result)
      ? (result as ReadonlyArray<{ acquired?: unknown }>)
      : (((result as { rows?: ReadonlyArray<{ acquired?: unknown }> })?.rows ??
          []) as ReadonlyArray<{ acquired?: unknown }>);
    const first = rows[0];
    return Boolean(first?.acquired);
  } catch {
    // If even the probe fails the safest behaviour is to skip the tick.
    return false;
  }
}

async function releaseAdvisoryLock(db: DrizzleLikeClient): Promise<void> {
  try {
    await db.execute(sql`SELECT pg_advisory_unlock(${WAKE_LOCK_ID})`);
  } catch {
    // Session-level locks release on disconnect anyway.
  }
}

async function defaultListActiveTenantIds(
  db: DrizzleLikeClient,
): Promise<ReadonlyArray<string>> {
  try {
    const result = (await db.execute(
      sql`SELECT id FROM tenants WHERE is_active = TRUE`,
    )) as unknown;
    const rows = Array.isArray(result)
      ? (result as ReadonlyArray<{ id?: unknown }>)
      : (((result as { rows?: ReadonlyArray<{ id?: unknown }> })?.rows ??
          []) as ReadonlyArray<{ id?: unknown }>);
    return rows
      .map((r) => (typeof r.id === 'string' ? r.id : String(r.id ?? '')))
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

export function createWakeLoopCronSupervisor(
  deps: WakeLoopCronDeps,
): WakeLoopCronSupervisor {
  const intervalMs = resolveIntervalMs(deps.intervalMs);

  let handle: ReturnType<typeof setInterval> | null = null;
  let inflight = false;

  async function tick(): Promise<WakeLoopCronTickResult | null> {
    if (inflight) return { tenantsProcessed: 0, goalsOpened: 0, goalsExecuted: 0, perTrigger: {}, skippedReason: 'lock-held' };
    inflight = true;
    try {
      if (!deps.db) {
        deps.logger.warn(
          { intervalMs },
          'wake-loop-cron: no db — supervisor is no-op',
        );
        return {
          tenantsProcessed: 0,
          goalsOpened: 0,
          goalsExecuted: 0,
          perTrigger: {},
          skippedReason: 'no-db',
        };
      }
      const db = deps.db as DrizzleLikeClient;
      const acquired = await tryAdvisoryLock(db);
      if (!acquired) {
        deps.logger.info(
          { lockId: WAKE_LOCK_ID },
          'wake-loop-cron: lock held by another replica/tick — skipping',
        );
        return {
          tenantsProcessed: 0,
          goalsOpened: 0,
          goalsExecuted: 0,
          perTrigger: {},
          skippedReason: 'lock-held',
        };
      }
      try {
        const listActive =
          deps.listActiveTenantIds ?? (() => defaultListActiveTenantIds(db));
        const tenantIds = await listActive();
        if (tenantIds.length === 0) {
          deps.logger.info(
            {},
            'wake-loop-cron: no active tenants — skipping cycle',
          );
          return {
            tenantsProcessed: 0,
            goalsOpened: 0,
            goalsExecuted: 0,
            perTrigger: {},
            skippedReason: 'no-tenants',
          };
        }

        // Build wake-loop deps from the same composition-root bindings
        // the sovereign brain uses. We construct fresh instances per
        // tick because the bindings are cheap (factories over the
        // shared Drizzle client) and we want every cycle to see the
        // latest registry state without stale closures.
        const goals = createKernelGoalsService(db as never);
        const auditSink = createKernelActionAuditService(db as never);
        const toolRegistry = agencyKernel.createActionToolRegistry();
        for (const stub of agencyKernel.DEFAULT_ACTION_TOOL_STUBS) {
          toolRegistry.register(stub);
        }
        const boundActionToolDeps = createBoundActionToolDeps(db as never);
        for (const realTool of agencyKernel.createRealActionTools(
          boundActionToolDeps,
        )) {
          toolRegistry.register(realTool);
        }
        const executor = agencyKernel.createExecutor({
          goals,
          tools: toolRegistry,
          auditSink,
          autonomyPolicy: agencyKernel.createDefaultAllowLowStakesPolicy(),
        });
        const boundWakeReadDeps = createBoundWakeReadDeps(db as never);
        const triggers = agencyKernel.createRealWakeTriggers({
          arrears: boundWakeReadDeps.arrearsRead,
          leases: boundWakeReadDeps.leaseRead,
          vacancy: boundWakeReadDeps.vacancyRead,
        });

        const outcome = await agencyKernel.runWakeCycle(
          { tenantIds },
          { goals, executor, triggers },
        );
        deps.logger.info(
          {
            tenants: tenantIds.length,
            goalsOpened: outcome.goalsOpened,
            goalsExecuted: outcome.goalsExecuted,
            perTrigger: outcome.perTrigger,
          },
          'wake-loop-cron: cycle complete',
        );
        return {
          tenantsProcessed: tenantIds.length,
          goalsOpened: outcome.goalsOpened,
          goalsExecuted: outcome.goalsExecuted,
          perTrigger: { ...outcome.perTrigger },
          skippedReason: null,
        };
      } finally {
        await releaseAdvisoryLock(db);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const errLog = deps.logger.error ?? deps.logger.warn;
      errLog({ err: msg }, 'wake-loop-cron: tick failed');
      return null;
    } finally {
      inflight = false;
    }
  }

  return {
    intervalMs,
    start() {
      if (handle) return;
      // First tick immediately so operators see the cron is alive in
      // the boot log without waiting `intervalMs`. setInterval is then
      // scheduled for steady-state cadence. When WAKE_LOOP_INTERVAL_MS=0
      // the supervisor behaves as a one-shot (the immediate tick fires
      // but no setInterval arms) — useful for k8s CronJob mode.
      void tick();
      if (process.env.WAKE_LOOP_INTERVAL_MS?.trim() === '0') {
        deps.logger.info(
          { mode: 'one-shot' },
          'wake-loop-cron: one-shot mode (CronJob driven)',
        );
        return;
      }
      handle = setInterval(() => void tick(), intervalMs);
      if (typeof handle.unref === 'function') handle.unref();
      deps.logger.info({ intervalMs }, 'wake-loop-cron: started');
    },
    stop() {
      if (!handle) return;
      clearInterval(handle);
      handle = null;
      deps.logger.info({}, 'wake-loop-cron: stopped');
    },
    tick,
  };
}

// ---------------------------------------------------------------------------
// CLI guard — `tsx wake-loop-cron.ts` runs one tick and exits.
// Powers the k8s/wake-loop-cron.yaml CronJob entrypoint. Mirrors the
// `consolidation-runner.ts` CLI pattern: lazy-imports db-client so unit
// tests of this module don't need a real DB connection at import time.
// ---------------------------------------------------------------------------

export async function runFromEnv(): Promise<WakeLoopCronTickResult | null> {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    // eslint-disable-next-line no-console
    console.warn(
      'wake-loop-cron CLI: DATABASE_URL not set — no-op',
    );
    return null;
  }
  let db: unknown = null;
  try {
    const mod = await import('./db-client.js');
    db = ((mod as { getDb?: () => unknown }).getDb?.() ?? null) as unknown;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('wake-loop-cron CLI: db-client import failed', error);
    return null;
  }
  const supervisor = createWakeLoopCronSupervisor({
    db,
    logger: {
      // eslint-disable-next-line no-console
      info: (obj, msg) => console.info('wake-loop-cron:', msg ?? '', obj),
      // eslint-disable-next-line no-console
      warn: (obj, msg) => console.warn('wake-loop-cron:', msg ?? '', obj),
      // eslint-disable-next-line no-console
      error: (obj, msg) => console.error('wake-loop-cron:', msg ?? '', obj),
    },
  });
  return supervisor.tick();
}

const isDirect =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === 'string' &&
  /wake-loop-cron(\.js|\.ts)?$/.test(process.argv[1]);

if (isDirect) {
  runFromEnv()
    .then((result) => {
      // eslint-disable-next-line no-console
      console.log('wake-loop-cron CLI:', result ?? '(no-op)');
      process.exit(0);
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('wake-loop-cron CLI: fatal', error);
      process.exit(2);
    });
}
