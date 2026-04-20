/**
 * Property-grading Drizzle schema.
 *
 * Mirrors migration 0088_property_grades.sql.
 *
 * Tables:
 *   - `property_grade_snapshots` — append-only snapshots of each grade
 *     computed by `scoreProperty()` in @bossnyumba/ai-copilot.
 *   - `tenant_grading_weights` — per-tenant override of the default
 *     DEFAULT_GRADING_WEIGHTS. Missing row = use defaults.
 */

import {
  pgTable,
  text,
  doublePrecision,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenant.schema.js';

export const propertyGradeSnapshots = pgTable(
  'property_grade_snapshots',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').notNull(),
    grade: text('grade').notNull(),
    score: doublePrecision('score').notNull(),
    dimensions: jsonb('dimensions').notNull().default({}),
    reasons: jsonb('reasons').notNull().default([]),
    inputs: jsonb('inputs').notNull().default({}),
    weights: jsonb('weights').notNull().default({}),
    computedAt: timestamp('computed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantPropertyIdx: index('idx_property_grade_snapshots_tenant_property').on(
      table.tenantId,
      table.propertyId,
      table.computedAt,
    ),
    latestIdx: index('idx_property_grade_snapshots_latest').on(
      table.tenantId,
      table.computedAt,
    ),
  }),
);

export const tenantGradingWeights = pgTable('tenant_grading_weights', {
  tenantId: text('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  incomeWeight: doublePrecision('income_weight').notNull().default(0.25),
  expenseWeight: doublePrecision('expense_weight').notNull().default(0.2),
  maintenanceWeight: doublePrecision('maintenance_weight')
    .notNull()
    .default(0.2),
  occupancyWeight: doublePrecision('occupancy_weight').notNull().default(0.15),
  complianceWeight: doublePrecision('compliance_weight')
    .notNull()
    .default(0.1),
  tenantWeight: doublePrecision('tenant_weight').notNull().default(0.1),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PropertyGradeSnapshotRow = typeof propertyGradeSnapshots.$inferSelect;
export type NewPropertyGradeSnapshotRow = typeof propertyGradeSnapshots.$inferInsert;
export type TenantGradingWeightsRow = typeof tenantGradingWeights.$inferSelect;
export type NewTenantGradingWeightsRow = typeof tenantGradingWeights.$inferInsert;
