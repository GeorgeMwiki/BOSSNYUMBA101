/**
 * Maintenance Problem Taxonomy — Wave 8 (S7 gap closure)
 *
 * Curated, per-tenant-overridable catalog of maintenance problems:
 *   - maintenance_problem_categories (plumbing, electrical, hvac, ...)
 *   - maintenance_problems           (leaf items with severity, SLA, scope)
 *
 * tenantId NULL means "platform default" — inherited by every org.
 * Orgs override by inserting their own rows with their tenantId.
 */

import { pgTable, text, integer, boolean, jsonb, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';

export const maintenanceProblemCategories = pgTable(
  'maintenance_problem_categories',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    displayOrder: integer('display_order').notNull().default(100),
    iconName: text('icon_name'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueTenantCode: unique().on(table.tenantId, table.code),
    tenantIdx: index('idx_mp_categories_tenant').on(table.tenantId),
  })
);

export const maintenanceProblems = pgTable(
  'maintenance_problems',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').notNull().references(() => maintenanceProblemCategories.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    defaultSeverity: text('default_severity').notNull().default('medium'),
    defaultSlaHours: integer('default_sla_hours').notNull().default(72),
    assetTypeScope: text('asset_type_scope').array().notNull().default([]),
    roomScope: text('room_scope').array().notNull().default([]),
    evidenceRequired: boolean('evidence_required').notNull().default(true),
    suggestedVendorTags: text('suggested_vendor_tags').array().notNull().default([]),
    active: boolean('active').notNull().default(true),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueTenantCode: unique().on(table.tenantId, table.code),
    categoryIdx: index('idx_mp_problems_category').on(table.categoryId),
    tenantIdx: index('idx_mp_problems_tenant').on(table.tenantId),
    severityIdx: index('idx_mp_problems_severity').on(table.tenantId, table.defaultSeverity),
  })
);

export const maintenanceProblemCategoriesRelations = relations(
  maintenanceProblemCategories,
  ({ many }) => ({
    problems: many(maintenanceProblems),
  })
);

export const maintenanceProblemsRelations = relations(
  maintenanceProblems,
  ({ one }) => ({
    category: one(maintenanceProblemCategories, {
      fields: [maintenanceProblems.categoryId],
      references: [maintenanceProblemCategories.id],
    }),
  })
);
