/**
 * Asset Components & Fitness-for-Assessment Review (FAR) Schemas (NEW 16)
 *
 * Asset components (roof, boiler, lift, etc.) are tracked individually with
 * their own condition cadence. A "FAR assignment" ties a monitoring schedule
 * to a component and drives condition-check events with a due-date trigger.
 *
 * Tables:
 *   - asset_components
 *   - far_assignments
 *   - condition_check_events
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

// ============================================================================
// Enums
// ============================================================================

export const assetComponentStatusEnum = pgEnum('asset_component_status', [
  'active',
  'monitoring',
  'needs_repair',
  'decommissioned',
]);

export const assetComponentConditionEnum = pgEnum('asset_component_condition', [
  'excellent',
  'good',
  'fair',
  'poor',
  'critical',
]);

export const farAssignmentStatusEnum = pgEnum('far_assignment_status', [
  'active',
  'paused',
  'cancelled',
  'completed',
]);

export const farCheckFrequencyEnum = pgEnum('far_check_frequency', [
  'weekly',
  'monthly',
  'quarterly',
  'biannual',
  'annual',
  'ad_hoc',
]);

export const conditionCheckOutcomeEnum = pgEnum('condition_check_outcome', [
  'pass',
  'warning',
  'fail',
  'skipped',
]);

// ============================================================================
// asset_components
// ============================================================================

export const assetComponents = pgTable(
  'asset_components',
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

    code: text('code').notNull(), // tenant-unique short code
    name: text('name').notNull(),
    category: text('category'), // e.g. structural, mechanical, electrical
    manufacturer: text('manufacturer'),
    modelNumber: text('model_number'),
    serialNumber: text('serial_number'),
    installedAt: timestamp('installed_at', { withTimezone: true }),
    expectedLifespanMonths: integer('expected_lifespan_months'),

    status: assetComponentStatusEnum('status').notNull().default('active'),
    currentCondition: assetComponentConditionEnum('current_condition')
      .notNull()
      .default('good'),

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
    tenantIdx: index('asset_components_tenant_idx').on(table.tenantId),
    propertyIdx: index('asset_components_property_idx').on(table.propertyId),
    unitIdx: index('asset_components_unit_idx').on(table.unitId),
    statusIdx: index('asset_components_status_idx').on(table.status),
    codeIdx: index('asset_components_code_idx').on(table.tenantId, table.code),
  })
);

// ============================================================================
// far_assignments
//  — binds a monitoring cadence to a component.
// ============================================================================

export const farAssignments = pgTable(
  'far_assignments',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    componentId: text('component_id')
      .notNull()
      .references(() => assetComponents.id, { onDelete: 'cascade' }),

    assignedTo: text('assigned_to').references(() => users.id, {
      onDelete: 'set null',
    }),
    frequency: farCheckFrequencyEnum('frequency').notNull(),
    status: farAssignmentStatusEnum('status').notNull().default('active'),

    // Triggering rules: how many days before due to notify, thresholds, etc.
    triggerRules: jsonb('trigger_rules').default({}),

    firstCheckDueAt: timestamp('first_check_due_at', { withTimezone: true }),
    nextCheckDueAt: timestamp('next_check_due_at', { withTimezone: true }),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),

    // Notification recipients (3 parties by convention): landlord, manager, vendor
    notifyRecipients: jsonb('notify_recipients').default([]),

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
    tenantIdx: index('far_assignments_tenant_idx').on(table.tenantId),
    componentIdx: index('far_assignments_component_idx').on(table.componentId),
    statusIdx: index('far_assignments_status_idx').on(table.status),
    nextCheckIdx: index('far_assignments_next_check_idx').on(
      table.nextCheckDueAt
    ),
  })
);

// ============================================================================
// condition_check_events
// ============================================================================

export const conditionCheckEvents = pgTable(
  'condition_check_events',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    farAssignmentId: text('far_assignment_id')
      .notNull()
      .references(() => farAssignments.id, { onDelete: 'cascade' }),
    componentId: text('component_id')
      .notNull()
      .references(() => assetComponents.id, { onDelete: 'cascade' }),

    performedBy: text('performed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    performedAt: timestamp('performed_at', { withTimezone: true }),

    outcome: conditionCheckOutcomeEnum('outcome').notNull().default('skipped'),
    conditionAfter: assetComponentConditionEnum('condition_after'),
    notes: text('notes'),
    photos: jsonb('photos').default([]),
    measurements: jsonb('measurements').default({}),

    // Notification fanout log (recipients, method, delivery status)
    notificationsLog: jsonb('notifications_log').default([]),

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
    tenantIdx: index('condition_check_events_tenant_idx').on(table.tenantId),
    assignmentIdx: index('condition_check_events_assignment_idx').on(
      table.farAssignmentId
    ),
    componentIdx: index('condition_check_events_component_idx').on(
      table.componentId
    ),
    dueAtIdx: index('condition_check_events_due_at_idx').on(table.dueAt),
    outcomeIdx: index('condition_check_events_outcome_idx').on(table.outcome),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const assetComponentsRelations = relations(
  assetComponents,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [assetComponents.tenantId],
      references: [tenants.id],
    }),
    property: one(properties, {
      fields: [assetComponents.propertyId],
      references: [properties.id],
    }),
    unit: one(units, {
      fields: [assetComponents.unitId],
      references: [units.id],
    }),
    farAssignments: many(farAssignments),
    conditionCheckEvents: many(conditionCheckEvents),
  })
);

export const farAssignmentsRelations = relations(
  farAssignments,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [farAssignments.tenantId],
      references: [tenants.id],
    }),
    component: one(assetComponents, {
      fields: [farAssignments.componentId],
      references: [assetComponents.id],
    }),
    assignee: one(users, {
      fields: [farAssignments.assignedTo],
      references: [users.id],
    }),
    events: many(conditionCheckEvents),
  })
);

export const conditionCheckEventsRelations = relations(
  conditionCheckEvents,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [conditionCheckEvents.tenantId],
      references: [tenants.id],
    }),
    assignment: one(farAssignments, {
      fields: [conditionCheckEvents.farAssignmentId],
      references: [farAssignments.id],
    }),
    component: one(assetComponents, {
      fields: [conditionCheckEvents.componentId],
      references: [assetComponents.id],
    }),
  })
);
