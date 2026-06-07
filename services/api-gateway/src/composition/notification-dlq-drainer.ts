/**
 * Notifications-dispatcher DLQ drainer (boot wiring).
 *
 * `services/notifications` has TWO delivery surfaces:
 *
 *   1. The DB-backed `notification_dispatch_log` worker — drained by
 *      `notification-dispatch-drainer.ts` (already wired at boot).
 *   2. The reliability-aware `enqueueNotification` dispatcher — provider
 *      failover within a channel + cross-channel fallback terminating in the
 *      always-available in-app inbox. When EVERY channel (including in-app)
 *      fails it dead-letters into the dispatcher's DLQ.
 *
 * This module wires a drainer for surface (2). Without it, a notification that
 * dead-letters during a transient total outage (inbox store briefly down +
 * every provider rate-limited) would sit in the DLQ forever. The drainer
 * re-runs each dead-lettered record through the full failover + fallback chain
 * on a timer, with backoff + a hard redrain cap (records are never silently
 * dropped — they are parked + an error is logged for an operator after the
 * cap).
 *
 * Multi-replica safety: each tick is gated by a Postgres advisory lock
 * (`CLUSTER_LOCK_IDS.NOTIFICATION_DLQ_DRAIN`) so exactly one replica drains at
 * a time. The notifications package is NOT a hard dependency of the gateway
 * (acyclic graph), so `createDlqDrainer` is resolved via a lazy dynamic
 * import; if the package is unavailable the wiring is a benign no-op.
 *
 * Degrades to a no-op under NODE_ENV==='test' or when explicitly disabled.
 */

import {
  CLUSTER_LOCK_IDS,
  withClusterLock,
  type ClusterLockDbLike,
  type ClusterLockLogger,
} from './cluster-lock.js';

export interface NotificationDlqDrainerOptions {
  /** Drizzle client used only for the advisory lock. Null → unguarded. */
  readonly db: ClusterLockDbLike | null;
  readonly logger: ClusterLockLogger & {
    info(obj: Record<string, unknown>, msg?: string): void;
    warn(obj: Record<string, unknown>, msg?: string): void;
  };
  readonly enabled?: boolean;
  readonly intervalMs?: number;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const DEFAULT_INTERVAL_MS = 30_000;

/**
 * Start the notifications DLQ drainer. Returns a `stop()` for the graceful-
 * shutdown path (mirrors `startNotificationDispatchDrainer`).
 */
export function startNotificationDlqDrainer(
  options: NotificationDlqDrainerOptions,
): () => void {
  const enabled =
    options.enabled ??
    (process.env.NODE_ENV !== 'test' &&
      process.env.NOTIFICATION_DLQ_DRAINER_DISABLED !== 'true');

  if (!enabled) {
    options.logger.info(
      { worker: 'notifications-dlq-drainer' },
      'notifications-dlq-drainer: disabled by env',
    );
    return () => undefined;
  }

  const intervalMs =
    options.intervalMs ??
    envInt('NOTIFICATION_DLQ_DRAIN_INTERVAL_MS', DEFAULT_INTERVAL_MS);

  // Cross-replica gate adapted to the drainer's `withLock` contract. When db
  // is null this resolves `{ ran: true }` so a single-pod / no-db deployment
  // still drains its own in-memory DLQ.
  const withLock = async <T>(
    fn: () => Promise<T>,
  ): Promise<{ ran: boolean; value?: T }> => {
    if (!options.db) {
      const value = await fn();
      return { ran: true, value };
    }
    const outcome = await withClusterLock(
      CLUSTER_LOCK_IDS.NOTIFICATION_DLQ_DRAIN,
      fn,
      {
        db: options.db,
        logger: options.logger,
        name: 'notifications-dlq-drainer',
      },
    );
    return outcome.ran
      ? { ran: true, value: outcome.value }
      : { ran: false };
  };

  let stopped = false;
  let stopInner: (() => void) | null = null;

  // The notifications service is resolved lazily (not a hard dep). If it is
  // unavailable the drainer is a no-op — the same fail-soft contract the OTP
  // enqueue binding uses.
  void (async () => {
    try {
      const specifier = '@bossnyumba/notifications-service';
      const mod = (await import(specifier).catch(() => null)) as
        | {
            createDlqDrainer?: (deps: {
              withLock: typeof withLock;
              logger: {
                info(meta: Record<string, unknown>, msg: string): void;
                warn(meta: Record<string, unknown>, msg: string): void;
                error(meta: Record<string, unknown>, msg: string): void;
              };
            }) => { start(intervalMs?: number): void; stop(): void };
          }
        | null;
      const createDlqDrainer = mod?.createDlqDrainer;
      if (typeof createDlqDrainer !== 'function') {
        options.logger.warn(
          { worker: 'notifications-dlq-drainer' },
          'notifications-dlq-drainer: @bossnyumba/notifications-service.createDlqDrainer unavailable — drainer inert',
        );
        return;
      }
      const handle = createDlqDrainer({
        withLock,
        logger: {
          info: (meta, msg) => options.logger.info(meta, msg),
          warn: (meta, msg) => options.logger.warn(meta, msg),
          error: (meta, msg) =>
            (options.logger.error ?? options.logger.warn)(meta, msg),
        },
      });
      if (stopped) return; // shutdown raced ahead of the import
      handle.start(intervalMs);
      stopInner = () => handle.stop();
      options.logger.info(
        { worker: 'notifications-dlq-drainer', intervalMs },
        'notifications-dlq-drainer wired',
      );
    } catch (err) {
      options.logger.warn(
        {
          worker: 'notifications-dlq-drainer',
          err: err instanceof Error ? err.message : String(err),
        },
        'notifications-dlq-drainer: wiring failed — drainer inert',
      );
    }
  })();

  return () => {
    stopped = true;
    stopInner?.();
  };
}
