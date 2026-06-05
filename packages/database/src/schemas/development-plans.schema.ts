/**
 * Property development pro-forma schema (Gap-4 d).
 *
 * BN's real-estate retarget of LitFin's loan business-plan generator. A
 * development pro-forma is what a property owner / developer uses to plan a
 * new build / refurbishment: which units, expected rent, construction cost,
 * financing, occupancy ramp, and the resulting return — all reachable from
 * Mr. Mwikila chat via the `development.plan.*` brain tools.
 *
 * Companion to:
 *   - packages/database/src/migrations/0310_development_plans.sql
 *   - services/api-gateway/src/routes/development-plans.hono.ts
 *   - services/api-gateway/src/composition/brain-tools/
 *       development-plan-tools.ts
 *
 * Two tables:
 *   - development_plans          one row per pro-forma (owner / developer
 *                                draft). Holds the financial-assumption set
 *                                as JSONB + a currency_code.
 *   - development_plan_sections  one row per section of a plan (e.g.
 *                                staffing-plan / tenant-demand / unit-mix).
 *
 * Tenant scope (CLAUDE.md hard rule): `app.current_tenant_id` GUC RLS,
 * FORCE-enabled, bound by the api-gateway database middleware.
 *
 * Multi-currency (CLAUDE.md hard rule): the plan carries `currencyCode`;
 * monetary financial assumptions live inside the `assumptions` JSONB (no
 * jurisdiction currency is hard-coded). The display surface formats with
 * formatCurrency.
 *
 * Section taxonomy retargeted from LitFin's business-plan sections:
 * management-organisation -> staffing-plan, market-analysis -> tenant-
 * demand, products-services -> unit-mix, use-of-loan -> use-of-funds,
 * sector-performance -> location-market.
 */

import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ── enum value catalogs (mirrored as CHECK constraints in mig 0310) ────

/** Development-plan lifecycle. */
export const DEVELOPMENT_PLAN_STATUSES = [
  'draft',
  'generating',
  'ready',
  'archived',
] as const;
export type DevelopmentPlanStatus =
  (typeof DEVELOPMENT_PLAN_STATUSES)[number];

/** Per-section lifecycle. */
export const DEVELOPMENT_PLAN_SECTION_STATUSES = [
  'pending',
  'generating',
  'ready',
] as const;
export type DevelopmentPlanSectionStatus =
  (typeof DEVELOPMENT_PLAN_SECTION_STATUSES)[number];

/**
 * Canonical development pro-forma section ids (retargeted from LitFin's
 * business-plan section taxonomy). Used by the brain tools to validate
 * which section is being generated / edited.
 */
export const DEVELOPMENT_PLAN_SECTION_KEYS = [
  'cover-page',
  'executive-summary',
  'location-market',
  'tenant-demand',
  'unit-mix',
  'staffing-plan',
  'use-of-funds',
  'financial-overview',
  'risk-mitigation',
  'swot-analysis',
] as const;
export type DevelopmentPlanSectionKey =
  (typeof DEVELOPMENT_PLAN_SECTION_KEYS)[number];

/**
 * Canonical financial-assumption keys (retargeted from LitFin's lending
 * assumptions to a property development pro-forma). Stored as keys inside
 * the `assumptions` JSONB; values are finite numbers. Currency-neutral —
 * monetary keys are interpreted in the plan's `currencyCode`.
 */
export const DEVELOPMENT_ASSUMPTION_KEYS = [
  'unit_count',
  'rent_per_unit_monthly',
  'construction_cost_per_unit',
  'land_cost',
  'occupancy_ramp_months',
  'stabilised_occupancy_rate',
  'operating_margin',
  'loan_interest_rate',
  'loan_term_months',
  'equity_contribution',
  'inflation_rate',
  'discount_rate',
  'exit_cap_rate',
] as const;
export type DevelopmentAssumptionKey =
  (typeof DEVELOPMENT_ASSUMPTION_KEYS)[number];

// ── development_plans ──────────────────────────────────────────────────

export const developmentPlans = pgTable(
  'development_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    title: text('title').notNull(),
    /** Optional property (no FK — a plan can precede the property row). */
    propertyId: uuid('property_id'),
    status: text('status').notNull().default('draft'),
    currencyCode: text('currency_code').notNull().default('TZS'),
    /** Financial assumption set: { assumptionKey: numericValue }. */
    assumptions: jsonb('assumptions').notNull().default({}),
    metadata: jsonb('metadata').notNull().default({}),
    provenance: jsonb('provenance').notNull().default({ via: 'unknown' }),
    auditHashId: text('audit_hash_id'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantStatusIdx: index('development_plans_tenant_status').on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
    tenantPropertyIdx: index('development_plans_tenant_property').on(
      table.tenantId,
      table.propertyId,
    ),
  }),
);

export type DevelopmentPlan = typeof developmentPlans.$inferSelect;
export type NewDevelopmentPlan = typeof developmentPlans.$inferInsert;

// ── development_plan_sections ──────────────────────────────────────────

export const developmentPlanSections = pgTable(
  'development_plan_sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => developmentPlans.id, { onDelete: 'cascade' }),
    sectionKey: text('section_key').notNull(),
    titleEn: text('title_en').notNull(),
    titleSw: text('title_sw').notNull(),
    bodyEn: text('body_en').notNull().default(''),
    bodySw: text('body_sw').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    status: text('status').notNull().default('pending'),
    provenance: jsonb('provenance').notNull().default({ via: 'unknown' }),
    auditHashId: text('audit_hash_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    planKeyUq: uniqueIndex('development_plan_sections_plan_key_uq').on(
      table.planId,
      table.sectionKey,
    ),
    tenantPlanIdx: index('development_plan_sections_tenant_plan').on(
      table.tenantId,
      table.planId,
      table.sortOrder,
    ),
  }),
);

export type DevelopmentPlanSection =
  typeof developmentPlanSections.$inferSelect;
export type NewDevelopmentPlanSection =
  typeof developmentPlanSections.$inferInsert;
