/**
 * Dead-letter drainer for the notifications dispatcher.
 *
 * The dispatcher (`enqueueNotification`) dead-letters a notification only
 * after EVERY channel in its cross-channel fallback chain — including the
 * always-available in-app terminal — has failed. That is usually a transient
 * outage (the inbox store was briefly unreachable, every provider was rate-
 * limited at once). Without a drainer those records sit in the DLQ forever and
 * the user never receives the notification.
 *
 * This drainer periodically claims a batch of dead-lettered records and
 * re-runs them through `enqueueNotification`, which re-attempts the full
 * failover + cross-channel chain. Records that redeliver are dropped; records
 * that still fail are re-queued with an incremented `redrainAttempts` counter
 * and an exponential backoff `notBefore` timestamp, until a hard cap — after
 * which they are left in the DLQ and a terminal event is emitted so an
 * operator/alerting path can intervene (we never silently discard).
 *
 * Multi-replica safety: the loop is gated by an injected `withLock` function
 * (the api-gateway composition passes a Postgres advisory-lock wrapper, the
 * same `CLUSTER_LOCK_IDS.NOTIFICATION_DISPATCH` family used by the DB-backed
 * dispatch drainer). When `withLock` is omitted the drainer runs unguarded
 * (single-pod / test).
 *
 * Everything is injected so this module has no I/O of its own and is fully
 * deterministic under test.
 */

import {
  deadLetterQueueInspector,
  enqueueNotification as defaultEnqueue,
  type DeadLetterRecord,
  type DispatchResult,
  type DispatcherDeps,
  type DrainableDeadLetterSource,
  type EnqueueNotificationInput,
} from './dispatcher.js';
import { logger as defaultLogger } from './logger.js';

/** A dead-letter record annotated with redrain bookkeeping. */
type RedrainableRecord = DeadLetterRecord & {
  redrainAttempts?: number;
  /** Epoch ms before which the record should not be re-attempted. */
  notBefore?: number;
};

export interface DlqDrainerLogger {
  info(meta: Record<string, unknown>, msg: string): void;
  warn(meta: Record<string, unknown>, msg: string): void;
  error(meta: Record<string, unknown>, msg: string): void;
}

export interface DlqDrainerDeps {
  /** Source of dead-letters. Defaults to the in-memory inspector. */
  readonly source?: DrainableDeadLetterSource;
  /** Re-delivery entry point. Defaults to the real `enqueueNotification`. */
  readonly enqueue?: (
    input: EnqueueNotificationInput,
    deps?: DispatcherDeps,
  ) => Promise<DispatchResult>;
  /** Dispatcher deps forwarded to every redelivery (providers, eventBus…). */
  readonly dispatcherDeps?: DispatcherDeps;
  /**
   * Cross-replica mutex. Receives the critical section; should run it iff this
   * replica holds the lock, and resolve `{ ran }`. Omit for single-pod/test.
   */
  readonly withLock?: <T>(
    fn: () => Promise<T>,
  ) => Promise<{ ran: boolean; value?: T }>;
  readonly logger?: DlqDrainerLogger;
  /** Override clock (tests). */
  readonly now?: () => number;
  /** Max records claimed per drain tick. Default 50. */
  readonly batchSize?: number;
  /** Max redrain attempts before a record is left for an operator. Default 5. */
  readonly maxRedrainAttempts?: number;
  /** Base backoff (ms) between redrain attempts. Default 60_000. */
  readonly backoffBaseMs?: number;
  /** Sleep hook for the run loop (tests inject a no-op). */
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface DlqDrainResult {
  readonly claimed: number;
  readonly redelivered: number;
  readonly requeued: number;
  readonly exhausted: number;
}

export interface DlqDrainerHandle {
  /** Run a single drain tick (lock-gated). Exposed for ops/tests. */
  drainOnce(): Promise<DlqDrainResult>;
  start(intervalMs?: number): void;
  stop(): void;
}

const DEFAULT_BATCH = 50;
const DEFAULT_MAX_REDRAIN = 5;
const DEFAULT_BACKOFF_BASE_MS = 60_000;
const DEFAULT_INTERVAL_MS = 30_000;

function computeBackoffMs(attempt: number, base: number): number {
  const exp = base * Math.pow(2, Math.max(0, attempt - 1));
  const jitter = exp * 0.25 * (Math.random() * 2 - 1); // ±25%
  return Math.max(0, Math.round(exp + jitter));
}

/**
 * Strip drainer bookkeeping fields so the record is a clean
 * `EnqueueNotificationInput` for redelivery.
 */
function toEnqueueInput(record: RedrainableRecord): EnqueueNotificationInput {
  const {
    attempts: _attempts,
    lastError: _lastError,
    deadLetteredAt: _deadLetteredAt,
    redrainAttempts: _redrainAttempts,
    notBefore: _notBefore,
    ...input
  } = record;
  return input;
}

export function createDlqDrainer(deps: DlqDrainerDeps = {}): DlqDrainerHandle {
  const source = deps.source ?? deadLetterQueueInspector;
  const enqueue = deps.enqueue ?? defaultEnqueue;
  const log = deps.logger ?? wrapPino();
  const now = deps.now ?? (() => Date.now());
  const batchSize = deps.batchSize ?? DEFAULT_BATCH;
  const maxRedrain = deps.maxRedrainAttempts ?? DEFAULT_MAX_REDRAIN;
  const backoffBaseMs = deps.backoffBaseMs ?? DEFAULT_BACKOFF_BASE_MS;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const withLock =
    deps.withLock ??
    (async <T>(fn: () => Promise<T>) => ({ ran: true, value: await fn() }));

  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  async function drainBatch(): Promise<DlqDrainResult> {
    const claimed = (await Promise.resolve(source.drain(batchSize))) as RedrainableRecord[];
    let redelivered = 0;
    let requeued = 0;
    let exhausted = 0;
    const nowMs = now();

    for (const record of claimed) {
      // Honour backoff — not yet time to retry this record.
      if (record.notBefore && record.notBefore > nowMs) {
        await Promise.resolve(source.push(record));
        requeued += 1;
        continue;
      }

      let result: DispatchResult;
      try {
        // Redeliver with idempotency disabled for the redrain: the original
        // dispatch already recorded a (failed) result under the same key, and
        // we WANT this retry to actually run rather than short-circuit on the
        // stored failure. Per-record idempotency at the DLQ layer is provided
        // by the source's atomic `drain()` claim.
        result = await enqueue(toEnqueueInput(record), {
          ...deps.dispatcherDeps,
          idempotencyStore: null,
        });
      } catch (err) {
        result = {
          accepted: false,
          attempts: 0,
          lastError: err instanceof Error ? err.message : String(err),
        };
      }

      if (result.accepted) {
        redelivered += 1;
        log.info(
          {
            worker: 'notifications-dlq-drainer',
            tenantId: record.tenantId,
            channel: record.channel,
            deliveredVia: result.deliveredVia ?? record.channel,
            redrainAttempts: record.redrainAttempts ?? 0,
          },
          'notifications-dlq-drainer: redelivered dead-lettered notification',
        );
        continue;
      }

      const nextAttempt = (record.redrainAttempts ?? 0) + 1;
      if (nextAttempt >= maxRedrain) {
        // Hard cap reached — leave it OUT of the active queue but surface a
        // terminal event so alerting can intervene. We do NOT silently drop:
        // re-push with a terminal marker so `all()` still shows it.
        exhausted += 1;
        await Promise.resolve(
          source.push({
            ...record,
            redrainAttempts: nextAttempt,
            lastError: `redrain exhausted after ${nextAttempt} attempts: ${result.lastError ?? 'unknown'}`,
            notBefore: Number.MAX_SAFE_INTEGER, // never auto-retried again
          } as RedrainableRecord),
        );
        log.error(
          {
            worker: 'notifications-dlq-drainer',
            tenantId: record.tenantId,
            channel: record.channel,
            redrainAttempts: nextAttempt,
            lastError: result.lastError,
          },
          'notifications-dlq-drainer: redrain exhausted — manual intervention required',
        );
        continue;
      }

      // Requeue with backoff for the next tick.
      requeued += 1;
      await Promise.resolve(
        source.push({
          ...record,
          redrainAttempts: nextAttempt,
          notBefore: nowMs + computeBackoffMs(nextAttempt, backoffBaseMs),
          lastError: result.lastError ?? record.lastError,
        } as RedrainableRecord),
      );
    }

    return { claimed: claimed.length, redelivered, requeued, exhausted };
  }

  async function drainOnce(): Promise<DlqDrainResult> {
    if (running) {
      return { claimed: 0, redelivered: 0, requeued: 0, exhausted: 0 };
    }
    running = true;
    try {
      const outcome = await withLock(async () => drainBatch());
      return (
        outcome.value ?? { claimed: 0, redelivered: 0, requeued: 0, exhausted: 0 }
      );
    } catch (err) {
      log.warn(
        {
          worker: 'notifications-dlq-drainer',
          err: err instanceof Error ? err.message : String(err),
        },
        'notifications-dlq-drainer: drain tick failed',
      );
      return { claimed: 0, redelivered: 0, requeued: 0, exhausted: 0 };
    } finally {
      running = false;
    }
  }

  function start(intervalMs = DEFAULT_INTERVAL_MS): void {
    if (timer) {
      log.warn(
        { worker: 'notifications-dlq-drainer' },
        'notifications-dlq-drainer: already running, ignoring duplicate start',
      );
      return;
    }
    log.info(
      { worker: 'notifications-dlq-drainer', intervalMs },
      'notifications-dlq-drainer started',
    );
    timer = setInterval(() => void drainOnce(), intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    void drainOnce();
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
      log.info(
        { worker: 'notifications-dlq-drainer' },
        'notifications-dlq-drainer stopped',
      );
    }
  }

  // Keep `sleep` referenced for callers wiring a custom run-loop; the
  // interval-based loop above does not need it but tests may.
  void sleep;

  return { drainOnce, start, stop };
}

/** Adapt the package's pino logger to the drainer's structured surface. */
function wrapPino(): DlqDrainerLogger {
  return {
    info: (meta, msg) => defaultLogger.info(msg, meta),
    warn: (meta, msg) => defaultLogger.warn(msg, meta),
    error: (meta, msg) => defaultLogger.error(msg, meta),
  };
}
