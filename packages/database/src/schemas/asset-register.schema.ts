/**
 * Fixed Asset Register & Condition Survey Schema
 * Annual asset tracking and condition assessment for auditing
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants, organizations, users } from './tenant.schema.js';
import { properties, units } from './property.schema.js';
import { customers } from './customer.schema.js';
import { leases } from './lease.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const fixedAssetTypeEnum = pgEnum('fixed_asset_type', [
  'building',
  'land',
  'warehouse',
  'godown',
  'infrastructure',
  'equipment',
  'vehicle',
  'other',
]);

export const assetConditionEnum = pgEnum('asset_condition', [
  'excellent',
  'good',
  'fair',
  'poor',
  'condemned',
  'not_assessed',
]);

export const assetOccupancyStatusEnum = pgEnum('asset_occupancy_status', [
  'occupied',
  'unoccupied',
  'partially_occupied',
]);

export const surveyStatusEnum = pgEnum('survey_status', [
  'planned',
  'in_progress',
  'completed',
  'cancelled',
  'overdue',
]);

export const surveyItemPriorityEnum = pgEnum('survey_item_priority', [
  'low',
  'medium',
  'high',
  'critical',
]);

// ============================================================================
// Fixed Asset Register Table
// ============================================================================

export const assetRegister = pgTable(
  'asset_register',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

    // Identity
    assetCode: text('asset_code').notNull(),
    name: text('name').notNull(),
    type: fixedAssetTypeEnum('type').notNull(),
    description: text('description'),

    // References to other entities
    propertyId: text('property_id').references(() => properties.id),
    unitId: text('unit_id').references(() => units.id),
    parcelId: text('parcel_id'), // FK to land_parcels
    organizationId: text('organization_id').references(() => organizations.id), // district/station

    // Financial
    acquisitionDate: timestamp('acquisition_date', { withTimezone: true }),
    acquisitionCost: integer('acquisition_cost'), // Minor units
    currency: text('currency').notNull().default('TZS'),
    currentBookValue: integer('current_book_value'),
    depreciationRate: decimal('depreciation_rate', { precision: 5, scale: 2 }),

    // Condition
    currentCondition: assetConditionEnum('current_condition').notNull().default('not_assessed'),
    lastSurveyDate: timestamp('last_survey_date', { withTimezone: true }),
    lastSurveyId: text('last_survey_id'),
    nextSurveyDue: timestamp('next_survey_due', { withTimezone: true }),

    // Occupancy
    occupancyStatus: assetOccupancyStatusEnum('occupancy_status').notNull().default('unoccupied'),
    currentCustomerId: text('current_customer_id').references(() => customers.id),
    currentLeaseId: text('current_lease_id').references(() => leases.id),
    monthlyRentAmount: integer('monthly_rent_amount'),
    annualRevenue: integer('annual_revenue'),

    // Location
    location: text('location'),
    latitude: decimal('latitude', { precision: 10, scale: 8 }),
    longitude: decimal('longitude', { precision: 11, scale: 8 }),

    // Media & docs
    images: jsonb('images').default([]),
    documents: jsonb('documents').default([]),
    metadata: jsonb('metadata').default({}),

    // Notes
    notes: text('notes'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('asset_register_tenant_idx').on(table.tenantId),
    codeTenantIdx: uniqueIndex('asset_register_code_tenant_idx').on(table.tenantId, table.assetCode),
    typeIdx: index('asset_register_type_idx').on(table.type),
    conditionIdx: index('asset_register_condition_idx').on(table.currentCondition),
    occupancyIdx: index('asset_register_occupancy_idx').on(table.occupancyStatus),
    orgIdx: index('asset_register_org_idx').on(table.organizationId),
    propertyIdx: index('asset_register_property_idx').on(table.propertyId),
  })
);

// ============================================================================
// Condition Surveys Table
// ============================================================================

export const conditionSurveys = pgTable(
  'condition_surveys',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

    // Identity
    surveyCode: text('survey_code').notNull(),
    title: text('title').notNull(),
    description: text('description'),

    // Status & timing
    status: surveyStatusEnum('status').notNull().default('planned'),
    financialYear: text('financial_year').notNull(), // e.g. "2025/2026"
    plannedStartDate: timestamp('planned_start_date', { withTimezone: true }),
    plannedEndDate: timestamp('planned_end_date', { withTimezone: true }),
    actualStartDate: timestamp('actual_start_date', { withTimezone: true }),
    actualEndDate: timestamp('actual_end_date', { withTimezone: true }),

    // Surveyor
    leadSurveyorId: text('lead_surveyor_id').references(() => users.id),
    surveyTeam: jsonb('survey_team').default([]), // [{userId, name, role}]

    // Scope
    organizationId: text('organization_id').references(() => organizations.id), // district scope
    totalAssets: integer('total_assets').notNull().default(0),
    completedAssets: integer('completed_assets').notNull().default(0),

    // Findings
    summary: text('summary'),
    findings: jsonb('findings').default({}),
    recommendations: jsonb('recommendations').default([]),
    totalEstimatedRepairCost: integer('total_estimated_repair_cost'),

    // Approval
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('condition_surveys_tenant_idx').on(table.tenantId),
    codeTenantIdx: uniqueIndex('condition_surveys_code_tenant_idx').on(table.tenantId, table.surveyCode),
    statusIdx: index('condition_surveys_status_idx').on(table.status),
    yearIdx: index('condition_surveys_year_idx').on(table.financialYear),
    orgIdx: index('condition_surveys_org_idx').on(table.organizationId),
  })
);

// ============================================================================
// Survey Items Table
// ============================================================================

export const surveyItems = pgTable(
  'survey_items',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    surveyId: text('survey_id').notNull().references(() => conditionSurveys.id, { onDelete: 'cascade' }),
    assetId: text('asset_id').notNull().references(() => assetRegister.id),

    // Surveyor
    surveyorId: text('surveyor_id').references(() => users.id),

    // Condition assessment
    conditionBefore: assetConditionEnum('condition_before'),
    conditionAfter: assetConditionEnum('condition_after').notNull(),

    // Detailed assessment
    structuralIntegrity: text('structural_integrity'),
    roofCondition: text('roof_condition'),
    plumbingCondition: text('plumbing_condition'),
    electricalCondition: text('electrical_condition'),
    paintCondition: text('paint_condition'),
    generalNotes: text('general_notes'),

    // Defects & repairs
    defectsFound: jsonb('defects_found').default([]), // [{description, severity, location, photo}]
    repairsRequired: jsonb('repairs_required').default([]), // [{description, priority, estimatedCost}]
    maintenanceRequired: boolean('maintenance_required').notNull().default(false),
    estimatedRepairCost: integer('estimated_repair_cost'),
    currency: text('currency').notNull().default('TZS'),
    priorityLevel: surveyItemPriorityEnum('priority_level'),

    // Evidence
    photos: jsonb('photos').default([]), // [{url, caption, takenAt, type: 'before'|'after'|'defect'}]

    // Timestamps
    surveyedAt: timestamp('surveyed_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('survey_items_tenant_idx').on(table.tenantId),
    surveyIdx: index('survey_items_survey_idx').on(table.surveyId),
    assetIdx: index('survey_items_asset_idx').on(table.assetId),
    conditionIdx: index('survey_items_condition_idx').on(table.conditionAfter),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const assetRegisterRelations = relations(assetRegister, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [assetRegister.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [assetRegister.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [assetRegister.unitId],
    references: [units.id],
  }),
  organization: one(organizations, {
    fields: [assetRegister.organizationId],
    references: [organizations.id],
  }),
  currentCustomer: one(customers, {
    fields: [assetRegister.currentCustomerId],
    references: [customers.id],
  }),
  currentLease: one(leases, {
    fields: [assetRegister.currentLeaseId],
    references: [leases.id],
  }),
  surveyItems: many(surveyItems),
}));

export const conditionSurveysRelations = relations(conditionSurveys, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [conditionSurveys.tenantId],
    references: [tenants.id],
  }),
  leadSurveyor: one(users, {
    fields: [conditionSurveys.leadSurveyorId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [conditionSurveys.organizationId],
    references: [organizations.id],
  }),
  items: many(surveyItems),
}));

export const surveyItemsRelations = relations(surveyItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [surveyItems.tenantId],
    references: [tenants.id],
  }),
  survey: one(conditionSurveys, {
    fields: [surveyItems.surveyId],
    references: [conditionSurveys.id],
  }),
  asset: one(assetRegister, {
    fields: [surveyItems.assetId],
    references: [assetRegister.id],
  }),
  surveyor: one(users, {
    fields: [surveyItems.surveyorId],
    references: [users.id],
  }),
}));
