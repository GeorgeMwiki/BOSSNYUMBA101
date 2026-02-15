/**
 * Compliance Schemas
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
import { tenants } from './tenant.schema.js';
import { properties } from './property.schema.js';
import { customers } from './customer.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const complianceItemTypeEnum = pgEnum('compliance_item_type', [
  'license',
  'permit',
  'inspection',
  'insurance',
  'certificate',
  'registration',
  'other',
]);

export const complianceEntityTypeEnum = pgEnum('compliance_entity_type', [
  'property',
  'unit',
  'customer',
  'lease',
  'vendor',
  'other',
]);

export const complianceStatusEnum = pgEnum('compliance_status', [
  'pending',
  'in_progress',
  'compliant',
  'non_compliant',
  'overdue',
  'waived',
  'cancelled',
]);

export const legalCaseTypeEnum = pgEnum('legal_case_type', [
  'eviction',
  'rent_dispute',
  'damage_claim',
  'breach_of_lease',
  'small_claims',
  'other',
]);

export const legalCaseStatusEnum = pgEnum('legal_case_status', [
  'open',
  'in_progress',
  'settled',
  'closed',
  'dismissed',
  'appealed',
]);

export const noticeTypeEnum = pgEnum('notice_type', [
  'rent_demand',
  'lease_violation',
  'eviction',
  'maintenance',
  'entry',
  'lease_termination',
  'other',
]);

// ============================================================================
// Compliance Items Table
// ============================================================================

export const complianceItems = pgTable(
  'compliance_items',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

    // Classification
    type: complianceItemTypeEnum('type').notNull(),
    entityType: complianceEntityTypeEnum('entity_type').notNull(),
    entityId: text('entity_id').notNull(),

    // Dates
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    completedDate: timestamp('completed_date', { withTimezone: true }),

    // Status
    status: complianceStatusEnum('status').notNull().default('pending'),

    // Details
    title: text('title').notNull(),
    description: text('description'),
    referenceNumber: text('reference_number'),
    documents: jsonb('documents').default([]),

    // Waiver
    waivedAt: timestamp('waived_at', { withTimezone: true }),
    waivedBy: text('waived_by'),
    waiverReason: text('waiver_reason'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('compliance_items_tenant_idx').on(table.tenantId),
    typeIdx: index('compliance_items_type_idx').on(table.type),
    entityIdx: index('compliance_items_entity_idx').on(table.entityType, table.entityId),
    statusIdx: index('compliance_items_status_idx').on(table.status),
    dueDateIdx: index('compliance_items_due_date_idx').on(table.dueDate),
  })
);

// ============================================================================
// Legal Cases Table
// ============================================================================

export const legalCases = pgTable(
  'legal_cases',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').references(() => properties.id, { onDelete: 'set null' }),
    customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),

    // Identity
    caseNumber: text('case_number').notNull(),
    type: legalCaseTypeEnum('type').notNull(),
    status: legalCaseStatusEnum('status').notNull().default('open'),

    // Details
    title: text('title').notNull(),
    description: text('description'),
    courtName: text('court_name'),
    courtCaseNumber: text('court_case_number'),

    // Dates
    filedDate: timestamp('filed_date', { withTimezone: true }),
    hearingDate: timestamp('hearing_date', { withTimezone: true }),
    closedDate: timestamp('closed_date', { withTimezone: true }),
    nextActionDate: timestamp('next_action_date', { withTimezone: true }),

    // Outcome
    outcome: text('outcome'),
    outcomeNotes: text('outcome_notes'),
    amountAwarded: integer('amount_awarded'),

    // Documents
    documents: jsonb('documents').default([]),

    // Assigned
    assignedTo: text('assigned_to'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('legal_cases_tenant_idx').on(table.tenantId),
    propertyIdx: index('legal_cases_property_idx').on(table.propertyId),
    customerIdx: index('legal_cases_customer_idx').on(table.customerId),
    caseNumberIdx: index('legal_cases_case_number_idx').on(table.tenantId, table.caseNumber),
    typeIdx: index('legal_cases_type_idx').on(table.type),
    statusIdx: index('legal_cases_status_idx').on(table.status),
    hearingDateIdx: index('legal_cases_hearing_date_idx').on(table.hearingDate),
  })
);

// ============================================================================
// Notices Table
// ============================================================================

export const notices = pgTable(
  'notices',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    propertyId: text('property_id').references(() => properties.id, { onDelete: 'set null' }),

    // Classification
    type: noticeTypeEnum('type').notNull(),

    // Details
    title: text('title').notNull(),
    content: text('content'),

    // Dates
    servedDate: timestamp('served_date', { withTimezone: true }),
    acknowledgedDate: timestamp('acknowledged_date', { withTimezone: true }),
    effectiveDate: timestamp('effective_date', { withTimezone: true }),
    expiryDate: timestamp('expiry_date', { withTimezone: true }),

    // Service
    serviceMethod: text('service_method'), // 'personal', 'mail', 'email', 'posted'
    servedBy: text('served_by'),
    proofOfService: jsonb('proof_of_service').default([]),

    // Response
    acknowledgedBy: text('acknowledged_by'),
    responseNotes: text('response_notes'),

    // Documents
    documents: jsonb('documents').default([]),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('notices_tenant_idx').on(table.tenantId),
    customerIdx: index('notices_customer_idx').on(table.customerId),
    propertyIdx: index('notices_property_idx').on(table.propertyId),
    typeIdx: index('notices_type_idx').on(table.type),
    servedDateIdx: index('notices_served_date_idx').on(table.servedDate),
    acknowledgedDateIdx: index('notices_acknowledged_date_idx').on(table.acknowledgedDate),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const complianceItemsRelations = relations(complianceItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [complianceItems.tenantId],
    references: [tenants.id],
  }),
}));

export const legalCasesRelations = relations(legalCases, ({ one }) => ({
  tenant: one(tenants, {
    fields: [legalCases.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [legalCases.propertyId],
    references: [properties.id],
  }),
  customer: one(customers, {
    fields: [legalCases.customerId],
    references: [customers.id],
  }),
}));

export const noticesRelations = relations(notices, ({ one }) => ({
  tenant: one(tenants, {
    fields: [notices.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [notices.customerId],
    references: [customers.id],
  }),
  property: one(properties, {
    fields: [notices.propertyId],
    references: [properties.id],
  }),
}));
