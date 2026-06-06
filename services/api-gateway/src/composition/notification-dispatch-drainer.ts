/**
 * Notification-dispatch drainer + stale-'sending' reaper (boot wiring).
 *
 * `services/notification-dispatch/dispatcher-worker.ts` builds a fully-
 * functional `createNotificationDispatcher` — atomic `pending → sending`
 * claim via `FOR UPDATE SKIP LOCKED`, provider routing, retry/backoff, DLQ.
 * But nothing ever STARTED it at boot, so every row that
 * `notification_dispatch_log` accumulated (lease-expiry alerts, monthly-close
 * statements, …) sat at `pending` forever and was never delivered.
 *
 * This module wires it into the gateway lifecycle with two guarded loops:
 *
 *   1. DRAINER — every `NOTIFICATION_DISPATCH_DRAIN_INTERVAL_MS` (default
 *      10s) one replica (the advisory-lock holder) drains the whole pending
 *      backlog in batches until empty, then yields the lock. The claim
 *      query is already race-safe across replicas, but gating the loop with
 *      `CLUSTER_LOCK_IDS.NOTIFICATION_DISPATCH` keeps exactly one replica
 *      doing the work so providers aren't hammered from 3 directions.
 *
 *   2. REAPER — every `NOTIFICATION_DISPATCH_REAP_INTERVAL_MS` (default
 *      60s) one replica resets rows wedged in `sending` for longer than
 *      `NOTIFICATION_DISPATCH_STALE_MINUTES` (default 10) back to
 *      `pending`. A replica can crash AFTER claiming a row (flipping it to
 *      `sending`) but BEFORE the provider call + `markSent`/`markFailed`.
 *      Without the reaper that row is stranded forever — the drainer only
 *      ever looks at `pending`. The reaper is the liveness backstop.
 *
 * Both loops degrade to a no-op when `db` is null (no DATABASE_URL) and are
 * skipped under NODE_ENV==='test' / explicit disable env. `start()` returns
 * a `stop()` the graceful-shutdown path calls.
 */

import { sql } from 'drizzle-orm';
import type { Logger } from 'pino';

import {
  createNotificationDispatcher,
  createEmailProviderFromEnv,
  resolveSmsProviderFromEnv,
} from '../services/notification-dispatch';
import {
  CLUSTER_LOCK_IDS,
  withClusterLock,
  type ClusterLockDeps,
  type ClusterLockDbLike,
} from './cluster-lock';

const DEFAULT_DRAIN_INTERVAL_MS = 10_000;
const DEFAULT_REAP_INTERVAL_MS = 60_000;
const DEFAULT_STALE_MINUTES = 10;
const DEFAULT_DRAIN_BATCH = 25;
// Bound the per-tick drain so one replica can't hold the lock indefinitely
// behind a huge backlog — it yields after this many batches and reacquires
// next interval (or another replica takes over).
const MAX_BATCHES_PER_TICK = 50;

export interface NotificationDispatchDrainerOptions {
  /** Drizzle client. Null → drainer + reaper are no-ops (degraded mode). */
  readonly db: ClusterLockDbLike | null;
  readonly logger: Logger;
  readonly enabled?: boolean;
  readonly drainIntervalMs?: number;
  readonly reapIntervalMs?: number;
  readonly staleMinutes?: number;
  readonly batchSize?: number;
}

export interface NotificationDispatchDrainerHandle {
  start(): void;
  stop(): void;
  /** Drain the backlog once (cluster-gated). Exposed for tests/ops. */
  drainOnce(): Promise<void>;
  /** Reap stale 'sending' rows once (cluster-gated). Exposed for tests/ops. */
  reapOnce(): Promise<number>;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function rowsOf(result: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result as ReadonlyArray<Record<string, unknown>>;
  }
  const wrapped = (result as { rows?: ReadonlyArray<Record<string, unknown>> })
    ?.rows;
  return Array.isArray(wrapped) ? wrapped : [];
}

/**
 * Reset rows stuck in `delivery_status = 'sending'` past the stale cutoff
 * back to `pending` so the drainer re-attempts them. `RETURNING id` lets us
 * report how many were rescued. Scoped platform-wide (service-account); the
 * drainer runs without a tenant JWT.
 */
export async function reapStaleSendingRows(
  db: ClusterLockDbLike,
  staleMinutes: number,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - staleMinutes * 60_000).toISOString();
  const res = await db.execute(sql`
    UPDATE notification_dispatch_log
       SET delivery_status = 'pending',
           updated_at = ${now.toISOString()}
     WHERE delivery_status = 'sending'
       AND COALESCE(last_attempt_at, updated_at, created_at) < ${cutoff}
    RETURNING id
  `);
  return rowsOf(res).length;
}

export function createNotificationDispatchDrainer(
  options: NotificationDispatchDrainerOptions,
): NotificationDispatchDrainerHandle {
  const enabled =
    options.enabled ??
    (process.env.NODE_ENV !== 'test' &&
      process.env.NOTIFICATION_DISPATCH_DRAINER_DISABLED !== 'true');

  const drainIntervalMs =
    options.drainIntervalMs ??
    envInt('NOTIFICATION_DISPATCH_DRAIN_INTERVAL_MS', DEFAULT_DRAIN_INTERVAL_MS);
  const reapIntervalMs =
    options.reapIntervalMs ??
    envInt('NOTIFICATION_DISPATCH_REAP_INTERVAL_MS', DEFAULT_REAP_INTERVAL_MS);
  const staleMinutes =
    options.staleMinutes ??
    envInt('NOTIFICATION_DISPATCH_STALE_MINUTES', DEFAULT_STALE_MINUTES);
  const batchSize = options.batchSize ?? DEFAULT_DRAIN_BATCH;

  // Null-db → inert handle. Callers never branch.
  if (!options.db) {
    options.logger.warn(
      { worker: 'notification-dispatch-drainer' },
      'notification-dispatch-drainer: no db — drainer + reaper inert (degraded mode)',
    );
    return {
      start() {},
      stop() {},
      async drainOnce() {},
      async reapOnce() {
        return 0;
      },
    };
  }

  const db = options.db;
  const lockDeps: ClusterLockDeps = {
    db,
    logger: options.logger,
    name: 'notification-dispatch-drainer',
  };

  const dispatcher = createNotificationDispatcher({
    db,
    logger: options.logger,
    emailProvider: createEmailProviderFromEnv(),
    smsProvider: resolveSmsProviderFromEnv(),
  });

  let drainTimer: NodeJS.Timeout | null = null;
  let reapTimer: NodeJS.Timeout | null = null;
  let drainRunning = false;
  let reapRunning = false;

  async function drainOnce(): Promise<void> {
    // In-process overlap guard — the cluster lock handles cross-replica.
    if (drainRunning) return;
    drainRunning = true;
    try {
      await withClusterLock(
        CLUSTER_LOCK_IDS.NOTIFICATION_DISPATCH,
        async () => {
          let totalClaimed = 0;
          let totalSent = 0;
          let totalFailed = 0;
          for (let i = 0; i < MAX_BATCHES_PER_TICK; i += 1) {
            const res = await dispatcher.runOnce({ batchSize });
            totalClaimed += res.claimed;
            totalSent += res.sent;
            totalFailed += res.failed;
            // Backlog drained — stop early and release the lock.
            if (res.claimed === 0) break;
          }
          if (totalClaimed > 0) {
            options.logger.info(
              {
                worker: 'notification-dispatch-drainer',
                claimed: totalClaimed,
                sent: totalSent,
                failed: totalFailed,
              },
              'notification-dispatch-drainer: drain tick complete',
            );
          }
        },
        lockDeps,
      );
    } catch (err) {
      options.logger.warn(
        {
          worker: 'notification-dispatch-drainer',
          err: err instanceof Error ? err.message : String(err),
        },
        'notification-dispatch-drainer: drain tick failed',
      );
    } finally {
      drainRunning = false;
    }
  }

  async function reapOnce(): Promise<number> {
    if (reapRunning) return 0;
    reapRunning = true;
    try {
      const outcome = await withClusterLock(
        CLUSTER_LOCK_IDS.NOTIFICATION_DISPATCH_REAPER,
        async () => reapStaleSendingRows(db, staleMinutes),
        lockDeps,
      );
      const reaped = outcome.ran ? outcome.value : 0;
      if (reaped > 0) {
        options.logger.warn(
          { worker: 'notification-dispatch-drainer', reaped, staleMinutes },
          'notification-dispatch-drainer: reset stale sending rows to pending',
        );
      }
      return reaped;
    } catch (err) {
      options.logger.warn(
        {
          worker: 'notification-dispatch-drainer',
          err: err instanceof Error ? err.message : String(err),
        },
        'notification-dispatch-drainer: reap tick failed',
      );
      return 0;
    } finally {
      reapRunning = false;
    }
  }

  return {
    start() {
      if (!enabled) {
        options.logger.info(
          { worker: 'notification-dispatch-drainer' },
          'notification-dispatch-drainer: disabled by env',
        );
        return;
      }
      if (drainTimer || reapTimer) {
        options.logger.warn(
          { worker: 'notification-dispatch-drainer' },
          'notification-dispatch-drainer: already running, ignoring duplicate start',
        );
        return;
      }
      options.logger.info(
        {
          worker: 'notification-dispatch-drainer',
          drainIntervalMs,
          reapIntervalMs,
          staleMinutes,
        },
        'notification-dispatch-drainer started',
      );
      drainTimer = setInterval(() => void drainOnce(), drainIntervalMs);
      reapTimer = setInterval(() => void reapOnce(), reapIntervalMs);
      if (typeof drainTimer.unref === 'function') drainTimer.unref();
      if (typeof reapTimer.unref === 'function') reapTimer.unref();
      // Kick both once immediately so a fresh boot starts converged.
      void reapOnce();
      void drainOnce();
    },
    stop() {
      if (drainTimer) {
        clearInterval(drainTimer);
        drainTimer = null;
      }
      if (reapTimer) {
        clearInterval(reapTimer);
        reapTimer = null;
      }
      options.logger.info(
        { worker: 'notification-dispatch-drainer' },
        'notification-dispatch-drainer stopped',
      );
    },
    drainOnce,
    reapOnce,
  };
}

/**
 * Convenience boot wiring — constructs the drainer, starts it, and returns
 * its `stop()` for the graceful-shutdown path. Mirrors
 * `registerIdempotencySweeperCron`'s call shape.
 */
export function startNotificationDispatchDrainer(
  options: NotificationDispatchDrainerOptions,
): () => void {
  const handle = createNotificationDispatchDrainer(options);
  handle.start();
  return () => handle.stop();
}
