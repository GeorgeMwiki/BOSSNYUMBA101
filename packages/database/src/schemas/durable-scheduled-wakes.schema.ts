/**
 * Durable scheduled wakes + armed monitors — crash-resilient backing store
 * for the orchestrator's `schedule_wake` / `monitor` Decisions.
 *
 * Context
 * -------
 * The in-process wake supervisor (`packages/central-intelligence/src/durable/
 * in-process-wake-scheduler.ts`) arms `schedule_wake` / `monitor` Decisions on
 * a process-local `setInterval` tick. That executes, but an arm made before a
 * process restart is LOST — the "wake me when X happens" superpower did not
 * survive a redeploy.
 *
 * These two tables close that gap: the supervisor PERSISTS every armed entry
 * here (keyed by `resume_token` / `watch_id`), DELETES it when it fires or
 * expires, and REHYDRATES the still-pending set on boot. The in-memory tick is
 * unchanged — these tables are the durable mirror so a restart re-loads the
 * pending wakes/monitors instead of dropping them.
 *
 * The Postgres impl of the pure `DurableWakeStore` port lives at
 * `services/api-gateway/src/composition/durable-wake-store.ts`; the composition
 * root binds it so durable scheduling is the DEFAULT (the storeless supervisor
 * is then the explicit fallback only).
 *
 * Migration: packages/database/src/migrations/0315_durable_scheduled_wakes.sql
 *
 * Scope + RLS
 * -----------
 * `tenant_id` is the scope the resumed turn re-enters under. It is NULL for a
 * `platform`-scoped wake (no tenant). RLS is FORCE-enabled per CLAUDE.md; the
 * supervisor is a system job that spans tenants on boot, so it reads/writes
 * under `withServiceRoleContext` (the 0179 service-role-bypass policy lets the
 * cross-tenant poller through) while the tenant-isolation policy still scopes
 * any per-tenant access.
 *
 * Immutability: rows are UPSERTed on re-arm and DELETEd on fire/expiry; no
 * in-place mutation of an armed entry's identity.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uuid,
  index,
} from 'drizzle-orm/pg-core';

/**
 * One row per armed `schedule_wake`. Keyed by `resume_token` (the supervisor
 * re-arm of the SAME intent UPSERTs, never duplicates). Deleted when the wake
 * fires.
 */
export const durableScheduledWakes = pgTable(
  'durable_scheduled_wakes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Echoed back into the resumed turn so it correlates to the intent. UNIQUE. */
    resumeToken: text('resume_token').notNull().unique(),
    /** Thread to revive when the wake fires. */
    threadId: text('thread_id').notNull(),
    /** Absolute time the orchestrator should be re-invoked at. */
    wakeAt: timestamp('wake_at', { withTimezone: true }).notNull(),
    /** Human-readable reason carried into the resumed turn + audit. */
    reason: text('reason').notNull(),
    /** Scope (tenant | platform) the resumed turn re-enters under. NULL = platform. */
    tenantId: text('tenant_id'),
    /** Full `ScopeContext` JSON so the resumed turn re-enters identically. */
    scope: jsonb('scope').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** Rehydrate / due-scan path. */
    wakeAtIdx: index('durable_scheduled_wakes_wake_at_idx').on(table.wakeAt),
    tenantIdx: index('durable_scheduled_wakes_tenant_idx').on(table.tenantId),
  }),
);

/**
 * One row per armed `monitor`. Keyed by `watch_id`. Deleted when the predicate
 * trips or the watch expires.
 */
export const durableArmedMonitors = pgTable(
  'durable_armed_monitors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Stable id correlating the monitor to the yielding turn. UNIQUE. */
    watchId: text('watch_id').notNull().unique(),
    /** Thread to revive when the predicate fires. */
    threadId: text('thread_id').notNull(),
    /** Coarse predicate description (e.g. `rent.paid`, `inspection.failed`). */
    predicate: text('predicate').notNull(),
    /** Absolute time the watch self-expires at (armedAt + timeoutMs). */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Scope (tenant | platform). NULL = platform. */
    tenantId: text('tenant_id'),
    /** Full `ScopeContext` JSON so the resumed turn re-enters identically. */
    scope: jsonb('scope').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** Rehydrate / expiry-scan path. */
    expiresAtIdx: index('durable_armed_monitors_expires_at_idx').on(
      table.expiresAt,
    ),
    tenantIdx: index('durable_armed_monitors_tenant_idx').on(table.tenantId),
  }),
);

export type DurableScheduledWakeRow = typeof durableScheduledWakes.$inferSelect;
export type NewDurableScheduledWakeRow =
  typeof durableScheduledWakes.$inferInsert;
export type DurableArmedMonitorRow = typeof durableArmedMonitors.$inferSelect;
export type NewDurableArmedMonitorRow =
  typeof durableArmedMonitors.$inferInsert;
