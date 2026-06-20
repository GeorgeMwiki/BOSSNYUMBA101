/**
 * staff_shifts — the REAL per-worker shift schedule source.
 *
 * Backs GET /api/v1/field/shifts/today (services/api-gateway/src/routes/
 * field/shifts.hono.ts), which the staff-mobile worker home card polls via
 * apps/staff-mobile/src/home/worker/useTodayShift.ts. Before this table the
 * route did not exist and the hook returned an HONEST empty state ("no
 * shift / unavailable") rather than fabricating a 06:00–18:00 day shift.
 *
 * One row = one scheduled shift for one employee on one calendar day.
 * `shiftKind` is day|night; `siteName` denormalises the building name at
 * schedule time so the worker card renders without a join (the building may
 * be renamed/removed later — the shift keeps the name it was scheduled for,
 * with `buildingId` kept for the live link). `startsAt`/`endsAt` are the
 * shift window; `nextBreakAt` is the next scheduled break (nullable — not
 * every shift has one).
 *
 * Task list for the shift is NOT stored here — it is resolved live from
 * `maintenance_tasks` (assignedToUserId + open status, due today) so the
 * card always shows the current queue, never a stale snapshot.
 *
 * Tenant-scoped → RLS FORCE + tenant_isolation + service_role_bypass live
 * in migration 0332_staff_shifts.sql. `tenantId` is TEXT so the predicate
 * is the bare `tenant_id = current_setting('app.current_tenant_id', true)`.
 */

import {
  pgTable,
  text,
  timestamp,
  date,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const STAFF_SHIFT_KINDS = ['day', 'night'] as const;
export type StaffShiftKind = (typeof STAFF_SHIFT_KINDS)[number];

export const staffShifts = pgTable(
  'staff_shifts',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),

    /** Employee (HR record) this shift is scheduled for. */
    employeeId: text('employee_id').notNull(),

    /**
     * Linked user identity — denormalised from `employees.user_id` at
     * schedule time so the route can resolve "my shift today" straight from
     * the authenticated JWT subject without a second join. Nullable because
     * not every employee has a portal login.
     */
    userId: text('user_id'),

    /** Calendar day the shift falls on (tenant-local date). */
    shiftDate: date('shift_date').notNull(),

    /** day | night. */
    shiftKind: text('shift_kind').$type<StaffShiftKind>().notNull().default('day'),

    /** Live link to the building this shift covers (nullable). */
    buildingId: text('building_id'),

    /** Site name denormalised at schedule time (always present for the card). */
    siteName: text('site_name').notNull(),

    /** Shift window. */
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),

    /** Next scheduled break within the window (nullable). */
    nextBreakAt: timestamp('next_break_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (t) => ({
    // Hot path: "this worker's shift for a given day".
    tenantUserDateIdx: index('staff_shifts_tenant_user_date_idx').on(
      t.tenantId,
      t.userId,
      t.shiftDate,
    ),
    tenantEmployeeDateIdx: index('staff_shifts_tenant_employee_date_idx').on(
      t.tenantId,
      t.employeeId,
      t.shiftDate,
    ),
    // One shift per employee per day per kind (a worker can have a day AND a
    // night shift on the same date, but not two of the same kind).
    uniqPerDay: uniqueIndex('staff_shifts_unique_employee_day_kind_idx').on(
      t.tenantId,
      t.employeeId,
      t.shiftDate,
      t.shiftKind,
    ),
  }),
);

export type StaffShiftRow = typeof staffShifts.$inferSelect;
export type NewStaffShiftRow = typeof staffShifts.$inferInsert;
