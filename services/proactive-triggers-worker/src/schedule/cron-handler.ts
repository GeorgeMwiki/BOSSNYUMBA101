/**
 * Cron handler — the hourly sweep.
 *
 * For every active tenant:
 *   - For every active (userId, role):
 *     - Build profile + signals
 *     - Compute triggers
 *     - For each trigger with urgency >= MIN_URGENCY:
 *       - Check idempotency — skip if seen in lookback
 *       - Otherwise: emit to sink, and ONLY on a confirmed-successful
 *         emit mark it seen + count it fired. A failed emit is NOT
 *         marked seen (so the next sweep retries it) and is counted as
 *         dropped — a non-zero dropped count raises a staff alert.
 *
 * Invoked two ways:
 *   1. In-process via setInterval (or node-cron) every hour
 *   2. As a one-shot when launched via a Kubernetes CronJob
 */
import {
  buildProfile,
  computeTriggers,
  gatherSignals,
  type Role,
  type Trigger,
} from '@bossnyumba/user-context-store';
import { iterateTenants } from './tenant-iteration.js';
import type {
  IdempotencyCache,
  StaffAlertSink,
  SweepSummary,
  TenantDirectory,
  TenantSweepResult,
  TriggerSink,
  WorkerLogger,
} from '../types.js';

export interface RunSweepDeps {
  readonly directory: TenantDirectory;
  readonly sink: TriggerSink;
  readonly cache: IdempotencyCache;
  readonly db: unknown;
  readonly logger?: WorkerLogger;
  /**
   * Operator alert sink. Fired once per tenant per sweep when one or
   * more triggers were dropped (emit failed). Optional — defaults to a
   * no-op so tests + dev stay quiet.
   */
  readonly staffAlertSink?: StaffAlertSink;
  readonly concurrency?: number;
  /** Minimum urgency to fire (default 4). */
  readonly minUrgency?: 1 | 2 | 3 | 4 | 5;
  /** Idempotency lookback window in hours (default 24). */
  readonly lookbackHours?: number;
}

const DEFAULT_MIN_URGENCY: 1 | 2 | 3 | 4 | 5 = 4;
const DEFAULT_LOOKBACK_HOURS = 24;

/**
 * The whole hourly sweep. Never throws.
 */
export async function runHourlySweep(deps: RunSweepDeps): Promise<SweepSummary> {
  const tenantIds = await safeListTenants(deps);
  if (tenantIds.length === 0) {
    deps.logger?.info?.({}, 'proactive-triggers-worker: no tenants — sweep is a no-op');
    return summarise([]);
  }

  const results = await iterateTenants({
    tenantIds,
    concurrency: deps.concurrency,
    ...(deps.logger ? { logger: deps.logger } : {}),
    runForTenant: (tenantId) => runForTenant(deps, tenantId),
  });

  return summarise(results);
}

async function safeListTenants(deps: RunSweepDeps): Promise<ReadonlyArray<string>> {
  try {
    return await deps.directory.listActiveTenants();
  } catch (error) {
    deps.logger?.warn?.(
      { err: error instanceof Error ? error.message : String(error) },
      'proactive-triggers-worker: tenant directory failed — sweep aborted',
    );
    return [];
  }
}

async function runForTenant(
  deps: RunSweepDeps,
  tenantId: string,
): Promise<TenantSweepResult> {
  const minUrgency = deps.minUrgency ?? DEFAULT_MIN_URGENCY;
  const lookbackHours = deps.lookbackHours ?? DEFAULT_LOOKBACK_HOURS;

  let users: ReadonlyArray<{ userId: string; role: Role }> = [];
  try {
    users = await deps.directory.listActiveUsers(tenantId);
  } catch (error) {
    return {
      tenantId,
      status: 'error',
      usersEvaluated: 0,
      triggersFired: 0,
      triggersSuppressedIdempotent: 0,
      triggersSuppressedLowUrgency: 0,
      triggersDropped: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  if (users.length === 0) {
    return {
      tenantId,
      status: 'skipped',
      usersEvaluated: 0,
      triggersFired: 0,
      triggersSuppressedIdempotent: 0,
      triggersSuppressedLowUrgency: 0,
      triggersDropped: 0,
      errorMessage: null,
    };
  }

  let triggersFired = 0;
  let triggersSuppressedIdempotent = 0;
  let triggersSuppressedLowUrgency = 0;
  let triggersDropped = 0;
  const droppedTriggerIds: string[] = [];

  for (const user of users) {
    try {
      const profile = await buildProfile({
        role: user.role,
        userId: user.userId,
        tenantId,
        db: deps.db,
      });
      const signals = await gatherSignals({
        role: user.role,
        userId: user.userId,
        tenantId,
        db: deps.db,
        profile,
      });
      const triggers = computeTriggers({
        profile,
        signals,
        role: user.role,
        userId: user.userId,
        tenantId,
      });

      for (const trigger of triggers) {
        if (trigger.urgency < minUrgency) {
          triggersSuppressedLowUrgency += 1;
          continue;
        }
        if (deps.cache.hasSeenRecently(trigger.id, lookbackHours)) {
          triggersSuppressedIdempotent += 1;
          continue;
        }
        // Emit FIRST. Only a confirmed-successful emit may mark the
        // trigger seen + count it fired. A failed emit must NOT be marked
        // seen — otherwise the trigger is permanently suppressed while
        // the user never got it. Instead we leave it unseen (next sweep
        // retries) and count it as dropped so a staff alert fires.
        const emit = await safeEmit(deps, tenantId, user.userId, user.role, trigger);
        if (emit.ok) {
          deps.cache.markSeen(trigger.id, lookbackHours);
          triggersFired += 1;
        } else {
          triggersDropped += 1;
          droppedTriggerIds.push(trigger.id);
        }
      }
    } catch (error) {
      deps.logger?.warn?.(
        {
          tenantId,
          userId: user.userId,
          role: user.role,
          err: error instanceof Error ? error.message : String(error),
        },
        'proactive-triggers-worker: per-user failure — skipping user',
      );
    }
  }

  if (triggersDropped > 0) {
    await raiseStaffAlert(deps, tenantId, triggersDropped, droppedTriggerIds);
  }

  return {
    tenantId,
    status: 'ok',
    usersEvaluated: users.length,
    triggersFired,
    triggersSuppressedIdempotent,
    triggersSuppressedLowUrgency,
    triggersDropped,
    errorMessage: null,
  };
}

/**
 * Raise a single operator alert summarising the triggers we failed to
 * deliver this sweep for one tenant. Best-effort: an alert-sink error is
 * logged and swallowed so it never knocks out the sweep. Carries counts
 * + ids only — no user PII, no trigger payloads.
 */
async function raiseStaffAlert(
  deps: RunSweepDeps,
  tenantId: string,
  droppedCount: number,
  triggerIds: ReadonlyArray<string>,
): Promise<void> {
  deps.logger?.warn?.(
    { tenantId, droppedCount, triggerIds },
    'proactive-triggers-worker: triggers dropped (emit failed) — left unseen for retry, raising staff alert',
  );
  if (!deps.staffAlertSink) return;
  try {
    await deps.staffAlertSink.raise({ tenantId, droppedCount, triggerIds });
  } catch (error) {
    deps.logger?.warn?.(
      {
        tenantId,
        droppedCount,
        err: error instanceof Error ? error.message : String(error),
      },
      'proactive-triggers-worker: staff-alert sink failed — dropped-trigger alert not raised',
    );
  }
}

/**
 * Emit one trigger to the sink. Returns `{ ok: true }` only when the
 * sink resolves cleanly; `{ ok: false }` on any throw. The caller uses
 * this to decide whether to mark the trigger seen (success) or leave it
 * for the next sweep (failure). Never throws.
 */
async function safeEmit(
  deps: RunSweepDeps,
  tenantId: string,
  userId: string,
  role: Role,
  trigger: Trigger,
): Promise<{ ok: boolean }> {
  try {
    await deps.sink.emit({ tenantId, userId, role, trigger });
    return { ok: true };
  } catch (error) {
    deps.logger?.warn?.(
      {
        tenantId,
        userId,
        role,
        triggerId: trigger.id,
        err: error instanceof Error ? error.message : String(error),
      },
      'proactive-triggers-worker: sink emit failed — trigger left unseen for next-sweep retry',
    );
    return { ok: false };
  }
}

function summarise(results: ReadonlyArray<TenantSweepResult>): SweepSummary {
  let usersEvaluated = 0;
  let triggersFired = 0;
  let triggersSuppressedIdempotent = 0;
  let triggersSuppressedLowUrgency = 0;
  let triggersDropped = 0;
  let errored = 0;
  for (const r of results) {
    usersEvaluated += r.usersEvaluated;
    triggersFired += r.triggersFired;
    triggersSuppressedIdempotent += r.triggersSuppressedIdempotent;
    triggersSuppressedLowUrgency += r.triggersSuppressedLowUrgency;
    triggersDropped += r.triggersDropped;
    if (r.status === 'error') errored += 1;
  }
  return {
    tenantsProcessed: results.length,
    usersEvaluated,
    triggersFired,
    triggersSuppressedIdempotent,
    triggersSuppressedLowUrgency,
    triggersDropped,
    errored,
    results,
  };
}
