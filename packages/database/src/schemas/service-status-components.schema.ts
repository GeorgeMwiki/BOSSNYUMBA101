/**
 * service_status_components — the maintained platform status board source.
 *
 * Backs the PUBLIC GET /api/v1/public/status (services/api-gateway/src/
 * routes/public-status.hono.ts), which the marketing /status page polls via
 * apps/marketing/src/components/StatusBoard.tsx every 30s.
 *
 * One row = one platform component (api-gateway / database / auth / storage
 * / workers / realtime). `currentStatus` is the operator/automation-set
 * health; `lastChangedAt` is when it last transitioned; `history` is a
 * rolling JSONB array of {date, status} day-buckets used to draw the uptime
 * strip; `uptimePct` is the maintained rolling uptime for the window.
 *
 * NOT TENANT-SCOPED. System status is platform-wide and read by
 * unauthenticated visitors (the marketing status page). RLS is still
 * ENABLE+FORCE'd (migration 0333) but the SELECT policy is PUBLIC-READ
 * (TO PUBLIC, USING (true)) while writes are restricted to the service role
 * — operators/automation update component health out-of-band, never the
 * anon web visitor. There is NO money, NO tenant data, and NO PII in this
 * table — only coarse green/amber/red component health.
 *
 * The public route reads from this table when it is populated; if a
 * component row is absent it is reported as `unknown` (honest-degrade), so
 * the board is never fabricated.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  numeric,
  index,
} from 'drizzle-orm/pg-core';

export const SERVICE_STATUS_COMPONENTS = [
  'api-gateway',
  'database',
  'auth',
  'storage',
  'workers',
  'realtime',
] as const;
export type ServiceStatusComponent =
  (typeof SERVICE_STATUS_COMPONENTS)[number];

export const SERVICE_STATUS_VALUES = [
  'ok',
  'degraded',
  'outage',
  'unknown',
] as const;
export type ServiceStatusValue = (typeof SERVICE_STATUS_VALUES)[number];

/** One {date, status} bucket in the rolling history strip. */
export interface ServiceStatusHistoryDay {
  readonly date: string;
  readonly status: ServiceStatusValue;
}

export const serviceStatusComponents = pgTable(
  'service_status_components',
  {
    /** The component name IS the natural key — one row per component. */
    component: text('component').$type<ServiceStatusComponent>().primaryKey(),

    currentStatus: text('current_status')
      .$type<ServiceStatusValue>()
      .notNull()
      .default('unknown'),

    /** When the component last transitioned (nullable until first change). */
    lastChangedAt: timestamp('last_changed_at', { withTimezone: true }),

    /** Rolling [{date, status}] day-buckets for the uptime strip. */
    history: jsonb('history')
      .$type<ReadonlyArray<ServiceStatusHistoryDay>>()
      .notNull()
      .default([]),

    /** Maintained rolling uptime percentage for the window (0..100). */
    uptimePct: numeric('uptime_pct', { precision: 6, scale: 3 })
      .notNull()
      .default('100'),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statusIdx: index('service_status_components_status_idx').on(
      t.currentStatus,
    ),
  }),
);

export type ServiceStatusComponentRow =
  typeof serviceStatusComponents.$inferSelect;
export type NewServiceStatusComponentRow =
  typeof serviceStatusComponents.$inferInsert;
