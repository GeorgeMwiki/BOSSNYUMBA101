/**
 * Tenant deletion schedules — durable right-to-erasure (migration 0337).
 *
 * Backs DELETE /api/v1/tenants/:id (services/api-gateway/src/routes/
 * tenants-admin.hono.ts), the GDPR Art.17 / KE-PDPA Art.26(2) / TZ-PDPA s.17
 * tenant-wide right-to-erasure surface. The route was a SILENT NO-OP — it
 * resolved an optional `tenantDeletion` service that is never wired and
 * returned 202 without persisting anything. It now writes a row here BEFORE
 * returning success; the platform tenant-purge worker walks
 * `status='scheduled' AND scheduled_purge_at <= now()` at expiry.
 *
 * Lifecycle: scheduled → purging → purged | cancelled.
 *
 * A unique partial index (`tenant_deletion_schedules_active_tenant_uq`)
 * guarantees AT MOST ONE active (scheduled/purging) row per tenant, so a
 * repeated DELETE upserts the existing schedule rather than stacking
 * duplicates.
 *
 * RLS-FORCE per CLAUDE.md hard rule: tenant-isolation policy lets a tenant
 * admin read back their own schedule; a service-role-bypass policy lets the
 * cross-tenant DELETE route (platform-admin target) + purge worker
 * read/write. See migration 0337.
 */

import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  integer,
  timestamp,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Drizzle partial-index predicate. Declared before the table so the index
// definition reads cleanly and there is no temporal-dead-zone reference.
const sqlActive = sql`status IN ('scheduled', 'purging')`;

export const TENANT_DELETION_STATUSES = [
  'scheduled',
  'purging',
  'purged',
  'cancelled',
] as const;
export type TenantDeletionStatus = (typeof TENANT_DELETION_STATUSES)[number];

/** KE PDPA Art.26(2) / TZ PDPA s.17 mandated minimum grace window. */
export const TENANT_DELETION_MIN_GRACE_DAYS = 30;

export const tenantDeletionSchedules = pgTable(
  'tenant_deletion_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    status: text('status').notNull().default('scheduled'),
    scheduledPurgeAt: timestamp('scheduled_purge_at', {
      withTimezone: true,
    }).notNull(),
    graceDays: integer('grace_days').notNull().default(30),
    requestedBy: text('requested_by').notNull(),
    requestedByRole: text('requested_by_role'),
    reason: text('reason'),
    affectedUsers: integer('affected_users').notNull().default(0),
    purgeStartedAt: timestamp('purge_started_at', { withTimezone: true }),
    purgedAt: timestamp('purged_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledBy: text('cancelled_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // At most one active (scheduled/purging) schedule per tenant. Mirrors
    // the partial unique index in migration 0337 so the upsert target is
    // unambiguous.
    activeTenantUq: uniqueIndex(
      'tenant_deletion_schedules_active_tenant_uq',
    )
      .on(t.tenantId)
      .where(sqlActive),
    dueIdx: index('tenant_deletion_schedules_due_idx').on(t.scheduledPurgeAt),
    tenantIdx: index('tenant_deletion_schedules_tenant_idx').on(t.tenantId),
  }),
);

export type TenantDeletionScheduleRow =
  typeof tenantDeletionSchedules.$inferSelect;
export type TenantDeletionScheduleInsert =
  typeof tenantDeletionSchedules.$inferInsert;
