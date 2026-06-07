/**
 * Cluster-wide single-flight lock for boot crons (multi-replica safety).
 *
 * BossNyumba runs the api-gateway as N replicas. Every replica boots the
 * same in-process `setInterval` crons (executive-brief, lease-expiry,
 * cases-SLA, decision-retrospective, outcome-reconciliation, intelligence-
 * history, mwikila-autonomous, notification-drainer …). Each cron only
 * guards itself with an in-process `running` boolean — which stops a tick
 * overrunning ITSELF on one replica, but does NOTHING cluster-wide. With 3
 * replicas a daily executive-brief fires 3×, AI-cost-ledger is charged 3×,
 * tenants get duplicate SMS, and SLA escalations double up.
 *
 * `services/api-gateway/src/composition/wake-loop-cron.ts` already solved
 * this for the wake-loop via a Postgres SESSION-LEVEL advisory lock
 * (`pg_try_advisory_lock`). This module extracts that exact dance into a
 * reusable helper so every other boot cron gets the same at-most-one-in-
 * flight-cluster-wide guarantee with a single wrapper call.
 *
 * Mechanics (identical to wake-loop-cron):
 *
 *   1. `SELECT pg_try_advisory_lock($lockId)` — NON-blocking. Returns
 *      `true` only if this session grabbed the lock; `false` if any other
 *      replica (or an overrunning tick on the same replica) already holds
 *      it.
 *   2. If NOT acquired → skip this tick. Another replica owns it; doing
 *      the work here would duplicate side effects. We return
 *      `{ ran: false, skippedReason: 'lock-held' }`.
 *   3. If acquired → run `fn()` inside try/finally and ALWAYS
 *      `pg_advisory_unlock($lockId)` afterwards. Session-level locks also
 *      auto-release on disconnect, so a crashed replica can never wedge
 *      the lock permanently.
 *
 * Degraded mode: when `db` is null (no DATABASE_URL) the helper is a benign
 * no-op that returns `{ ran: false, skippedReason: 'no-db' }`. A
 * misconfigured cron must never crash the gateway — same contract as
 * wake-loop-cron + consolidation-runner.
 *
 * Failure isolation: a probe-time DB error (acquire query throws) is
 * treated as "lock not acquired" → skip the tick. This is the SAFE
 * default — if we cannot prove we own the lock we must assume another
 * replica might, and not run cost-bearing work.
 */

import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Lock-id registry — one UNIQUE BIGINT per cluster-locked cron.
// ---------------------------------------------------------------------------

/**
 * Stable, documented advisory-lock ids. Each constant is a distinct BIGINT
 * inside the JS safe-integer range so `pg_try_advisory_lock(bigint)` keys
 * cleanly. NEVER reuse an id across two crons — sharing one id would make
 * the crons mutually exclude each other (a lease-expiry tick would block an
 * executive-brief tick on a different replica), which is wrong.
 *
 * `WAKE_LOOP` mirrors the literal `WAKE_LOCK_ID` already used by
 * `wake-loop-cron.ts` (7321946218472901) so the two never collide — it is
 * recorded here for documentation; wake-loop-cron keeps its own const.
 *
 * The numbers were chosen by hand to be obviously-distinct and to sit well
 * inside `Number.MAX_SAFE_INTEGER` (9007199254740991).
 */
export const CLUSTER_LOCK_IDS = {
  /** wake-loop-cron.ts owns this literally; listed for collision-avoidance. */
  WAKE_LOOP: 7321946218472901,
  EXECUTIVE_BRIEF: 7321946218472902,
  CASES_SLA: 7321946218472903,
  LEASE_EXPIRY: 7321946218472904,
  DECISION_RETROSPECTIVE: 7321946218472905,
  OUTCOME_RECONCILIATION: 7321946218472906,
  INTELLIGENCE_HISTORY: 7321946218472907,
  MWIKILA_AUTONOMOUS: 7321946218472908,
  NOTIFICATION_DISPATCH: 7321946218472909,
  NOTIFICATION_DISPATCH_REAPER: 7321946218472910,
  /** In-memory dispatcher DLQ drainer (services/notifications dlq-drainer). */
  NOTIFICATION_DLQ_DRAIN: 7321946218472911,
} as const;

export type ClusterLockName = keyof typeof CLUSTER_LOCK_IDS;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal Drizzle/postgres-js client surface this helper touches. */
export interface ClusterLockDbLike {
  execute(query: unknown): Promise<unknown>;
}

export interface ClusterLockLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error?(obj: Record<string, unknown>, msg?: string): void;
}

export interface ClusterLockDeps {
  /** Drizzle client. May be null — helper degrades to a no-op skip. */
  readonly db: ClusterLockDbLike | null;
  readonly logger: ClusterLockLogger;
  /**
   * Human-readable name for log lines (e.g. 'executive-brief-cron'). Pure
   * observability — does not affect locking.
   */
  readonly name: string;
}

/** Outcome of a `withClusterLock` call. */
export type ClusterLockResult<T> =
  | { readonly ran: true; readonly value: T; readonly skippedReason: null }
  | {
      readonly ran: false;
      readonly value: null;
      readonly skippedReason: 'lock-held' | 'no-db';
    };

// ---------------------------------------------------------------------------
// Internal advisory-lock primitives — mirror wake-loop-cron.ts exactly.
// ---------------------------------------------------------------------------

function rowsOf(result: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result as ReadonlyArray<Record<string, unknown>>;
  }
  const wrapped = (result as { rows?: ReadonlyArray<Record<string, unknown>> })
    ?.rows;
  return Array.isArray(wrapped) ? wrapped : [];
}

async function tryAcquire(
  db: ClusterLockDbLike,
  lockId: number,
): Promise<boolean> {
  try {
    const result = await db.execute(
      sql`SELECT pg_try_advisory_lock(${lockId}) AS acquired`,
    );
    const first = rowsOf(result)[0];
    return Boolean(first?.acquired);
  } catch {
    // If even the probe fails the safest behaviour is to skip the tick —
    // we cannot prove we own the lock, so we must assume we do not.
    return false;
  }
}

async function release(db: ClusterLockDbLike, lockId: number): Promise<void> {
  try {
    await db.execute(sql`SELECT pg_advisory_unlock(${lockId})`);
  } catch {
    // Session-level locks release on disconnect anyway — a failed unlock
    // is not fatal; it just delays release until the connection drops.
  }
}

// ---------------------------------------------------------------------------
// Public helper
// ---------------------------------------------------------------------------

/**
 * Run `fn` at most once cluster-wide for the given `lockId`.
 *
 * - Acquires `pg_try_advisory_lock(lockId)`. If another replica holds it,
 *   `fn` is NOT called and the result is `{ ran: false, skippedReason:
 *   'lock-held' }`.
 * - On acquisition, `fn` runs inside try/finally and the lock is ALWAYS
 *   released afterwards (even if `fn` throws — the throw propagates).
 * - When `deps.db` is null the helper is a no-op returning
 *   `{ ran: false, skippedReason: 'no-db' }`.
 *
 * Callers that schedule via `setInterval` should wrap their tick body:
 *
 *   await withClusterLock(CLUSTER_LOCK_IDS.EXECUTIVE_BRIEF, realTick, deps);
 */
export async function withClusterLock<T>(
  lockId: number,
  fn: () => Promise<T>,
  deps: ClusterLockDeps,
): Promise<ClusterLockResult<T>> {
  if (!deps.db) {
    deps.logger.warn(
      { cron: deps.name, lockId },
      'cluster-lock: no db — skipping tick (degraded mode)',
    );
    return { ran: false, value: null, skippedReason: 'no-db' };
  }

  const db = deps.db;
  const acquired = await tryAcquire(db, lockId);
  if (!acquired) {
    deps.logger.info(
      { cron: deps.name, lockId },
      'cluster-lock: lock held by another replica/tick — skipping',
    );
    return { ran: false, value: null, skippedReason: 'lock-held' };
  }

  try {
    const value = await fn();
    return { ran: true, value, skippedReason: null };
  } finally {
    await release(db, lockId);
  }
}

/**
 * Curried convenience — bind the lock id + deps once and get a wrapper that
 * gates any tick. Useful where a cron factory accepts a single
 * `clusterLock?: (fn) => Promise<void>` dependency:
 *
 *   const gate = makeClusterLockGate(CLUSTER_LOCK_IDS.CASES_SLA, deps);
 *   // inside the cron: `await gate(() => realTick());`
 *
 * The returned function swallows the discriminated result and resolves to
 * void — the cron's own `running` guard + the skip log are enough; callers
 * that need the result use `withClusterLock` directly.
 */
export function makeClusterLockGate(
  lockId: number,
  deps: ClusterLockDeps,
): (fn: () => Promise<void>) => Promise<void> {
  return async (fn: () => Promise<void>): Promise<void> => {
    await withClusterLock(lockId, fn, deps);
  };
}
