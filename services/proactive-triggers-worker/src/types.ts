/**
 * Proactive Triggers Worker — shared types.
 *
 * Hourly sweep: for every active tenant, for every active user (per
 * role), build the dossier + signals, compute proactive triggers, and
 * push any high-urgency trigger (>=4) that hasn't fired in the lookback
 * window to the notification sink.
 *
 * Wire-agnostic: the sink, tenant directory, user iterator, and the
 * profile/signal/trigger pipeline are all injected. This is the
 * contract every other module in this service consumes.
 */
import type { Role, Trigger } from '@bossnyumba/user-context-store';

/**
 * Lightweight logger matching the brain-evolution-worker shape.
 */
export interface WorkerLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error?(obj: Record<string, unknown>, msg?: string): void;
}

/**
 * Where the worker drops the triggers it decides to publish. Real
 * deployments wire this to the notification adapter (in-app push,
 * email, WhatsApp, etc.). Tests wire a vi-spy.
 */
export interface TriggerSink {
  emit(args: {
    tenantId: string;
    userId: string;
    role: Role;
    trigger: Trigger;
  }): Promise<void> | void;
}

/**
 * Staff-alert port — fired when triggers are DROPPED (emit failed) so a
 * human operator notices that high-urgency advice never reached a user.
 * Carries counts + ids only (no PII / no trigger payloads), mirroring
 * `ReminderStaffAlertSink` in `@bossnyumba/notifications-service`.
 *
 * Default wiring is a no-op so tests + dev stay quiet; production wires
 * the in-app operator inbox at the composition root / bootstrap.
 */
export interface StaffAlertSink {
  raise(args: {
    tenantId: string;
    /** How many triggers failed to emit in this sweep for this tenant. */
    droppedCount: number;
    /** Stable trigger ids that were dropped (for operator triage). */
    triggerIds: ReadonlyArray<string>;
  }): Promise<void> | void;
}

/**
 * A single user the worker should process. The directory yields these.
 */
export interface ActiveUser {
  readonly userId: string;
  readonly role: Role;
}

/**
 * The directory the worker uses to find work. Real implementations
 * query Drizzle; tests pass an in-memory array.
 */
export interface TenantDirectory {
  /** List every active tenant the sweep should process. */
  listActiveTenants(): Promise<ReadonlyArray<string>>;
  /** List every active (user, role) pair we should evaluate per tenant. */
  listActiveUsers(tenantId: string): Promise<ReadonlyArray<ActiveUser>>;
}

/**
 * Idempotency port — `hasSeenRecently` returns true if the same
 * (userId, kind, day) combination already fired within the lookback
 * window. The default implementation is an in-memory LRU; production
 * swaps for Redis with TTLs that mirror the lookback.
 */
export interface IdempotencyCache {
  hasSeenRecently(triggerKey: string, withinHours: number): boolean;
  markSeen(triggerKey: string, withinHours: number): void;
}

/**
 * Per-tenant sweep summary. Used by the iterator to roll up final stats.
 */
export interface TenantSweepResult {
  readonly tenantId: string;
  readonly status: 'ok' | 'skipped' | 'error';
  readonly usersEvaluated: number;
  readonly triggersFired: number;
  readonly triggersSuppressedIdempotent: number;
  readonly triggersSuppressedLowUrgency: number;
  /**
   * Triggers that should have fired but whose sink emit FAILED. They are
   * deliberately NOT marked seen, so the next sweep retries them. A
   * non-zero value raises a staff alert.
   */
  readonly triggersDropped: number;
  readonly errorMessage: string | null;
}

/**
 * Aggregate summary over an entire sweep.
 */
export interface SweepSummary {
  readonly tenantsProcessed: number;
  readonly usersEvaluated: number;
  readonly triggersFired: number;
  readonly triggersSuppressedIdempotent: number;
  readonly triggersSuppressedLowUrgency: number;
  /** Sum of per-tenant {@link TenantSweepResult.triggersDropped}. */
  readonly triggersDropped: number;
  readonly errored: number;
  readonly results: ReadonlyArray<TenantSweepResult>;
}
