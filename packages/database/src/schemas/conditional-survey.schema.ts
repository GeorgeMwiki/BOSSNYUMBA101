/**
 * Conditional Survey Schemas (NEW 2)
 *
 * Conditional surveys capture a structured, dated snapshot of a property's
 * condition — scheduled on a cadence or ad-hoc when something triggers
 * deeper investigation. A survey produces findings and an action plan.
 *
 * Tables:
 *   - conditional_surveys
 *   - conditional_survey_findings
 *   - conditional_survey_action_plans
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants, users } from './tenant.schema.js';
import { properties, units } from './property.schema.js';
import { inspections } from './inspections.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const conditionalSurveyStatusEnum = pgEnum('conditional_survey_status', [
  'draft',
  'scheduled',
  'in_progress',
  'compiled',
  'approved',
  'archived',
  'cancelled',
]);

export const conditionalSurveySeverityEnum = pgEnum(
  'conditional_survey_severity',
  ['low', 'medium', 'high', 'critical']
);

export const conditionalSurveyActionStatusEnum = pgEnum(
  'conditional_survey_action_status',
  ['proposed', 'approved', 'in_progress', 'completed', 'deferred', 'rejected']
);

// ============================================================================
// conditional_surveys
// ============================================================================

export const conditionalSurveys = pgTable(
  'conditional_surveys',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    unitId: text('unit_id').references(() => units.id, {
      onDelete: 'set null',
    }),

    // Optional link back to an inspection that was upgraded to a conditional survey.
    sourceInspectionId: text('source_inspection_id').references(
      () => inspections.id,
      { onDelete: 'set null' }
    ),

    surveyorId: text('surveyor_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    status: conditionalSurveyStatusEnum('status').notNull().default('draft'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    compiledAt: timestamp('compiled_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),

    // Freeform narrative + structured summary produced at compile-time.
    narrative: text('narrative'),
    summary: jsonb('summary').default({}),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('conditional_surveys_tenant_idx').on(table.tenantId),
    propertyIdx: index('conditional_surveys_property_idx').on(table.propertyId),
    unitIdx: index('conditional_surveys_unit_idx').on(table.unitId),
    statusIdx: index('conditional_surveys_status_idx').on(table.status),
    scheduledAtIdx: index('conditional_surveys_scheduled_at_idx').on(
      table.scheduledAt
    ),
  })
);

// ============================================================================
// conditional_survey_findings
// ============================================================================

export const conditionalSurveyFindings = pgTable(
  'conditional_survey_findings',
  {
    id: text('id').primaryKey(),
    surveyId: text('survey_id')
      .notNull()
      .references(() => conditionalSurveys.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Finding details
    area: text('area').notNull(), // e.g. 'Roof', 'Plumbing', 'Bedroom 1'
    title: text('title').notNull(),
    description: text('description'),
    severity: conditionalSurveySeverityEnum('severity')
      .notNull()
      .default('low'),

    // Evidence
    photos: jsonb('photos').default([]),
    attachments: jsonb('attachments').default([]),

    // Freeform structured data (component refs, measurements, etc.)
    metadata: jsonb('metadata').default({}),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    surveyIdx: index('conditional_survey_findings_survey_idx').on(
      table.surveyId
    ),
    tenantIdx: index('conditional_survey_findings_tenant_idx').on(
      table.tenantId
    ),
    severityIdx: index('conditional_survey_findings_severity_idx').on(
      table.severity
    ),
  })
);

// ============================================================================
// conditional_survey_action_plans
// ============================================================================

export const conditionalSurveyActionPlans = pgTable(
  'conditional_survey_action_plans',
  {
    id: text('id').primaryKey(),
    surveyId: text('survey_id')
      .notNull()
      .references(() => conditionalSurveys.id, { onDelete: 'cascade' }),
    findingId: text('finding_id').references(
      () => conditionalSurveyFindings.id,
      { onDelete: 'set null' }
    ),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    title: text('title').notNull(),
    description: text('description'),
    priority: integer('priority').notNull().default(3), // 1 = highest, 5 = lowest
    status: conditionalSurveyActionStatusEnum('status')
      .notNull()
      .default('proposed'),

    estimatedCost: integer('estimated_cost_cents'), // in minor units
    currency: text('currency').default('KES'),
    targetDate: timestamp('target_date', { withTimezone: true }),

    approvedBy: text('approved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    surveyIdx: index('conditional_survey_action_plans_survey_idx').on(
      table.surveyId
    ),
    findingIdx: index('conditional_survey_action_plans_finding_idx').on(
      table.findingId
    ),
    tenantIdx: index('conditional_survey_action_plans_tenant_idx').on(
      table.tenantId
    ),
    statusIdx: index('conditional_survey_action_plans_status_idx').on(
      table.status
    ),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const conditionalSurveysRelations = relations(
  conditionalSurveys,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [conditionalSurveys.tenantId],
      references: [tenants.id],
    }),
    property: one(properties, {
      fields: [conditionalSurveys.propertyId],
      references: [properties.id],
    }),
    unit: one(units, {
      fields: [conditionalSurveys.unitId],
      references: [units.id],
    }),
    surveyor: one(users, {
      fields: [conditionalSurveys.surveyorId],
      references: [users.id],
    }),
    sourceInspection: one(inspections, {
      fields: [conditionalSurveys.sourceInspectionId],
      references: [inspections.id],
    }),
    findings: many(conditionalSurveyFindings),
    actionPlans: many(conditionalSurveyActionPlans),
  })
);

export const conditionalSurveyFindingsRelations = relations(
  conditionalSurveyFindings,
  ({ one, many }) => ({
    survey: one(conditionalSurveys, {
      fields: [conditionalSurveyFindings.surveyId],
      references: [conditionalSurveys.id],
    }),
    actionPlans: many(conditionalSurveyActionPlans),
  })
);

export const conditionalSurveyActionPlansRelations = relations(
  conditionalSurveyActionPlans,
  ({ one }) => ({
    survey: one(conditionalSurveys, {
      fields: [conditionalSurveyActionPlans.surveyId],
      references: [conditionalSurveys.id],
    }),
    finding: one(conditionalSurveyFindings, {
      fields: [conditionalSurveyActionPlans.findingId],
      references: [conditionalSurveyFindings.id],
    }),
  })
);
