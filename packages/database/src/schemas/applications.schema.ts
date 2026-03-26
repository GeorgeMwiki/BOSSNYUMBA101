/**
 * Application Letters Schema
 * Digitized application intake, routing from Station→HQ→EMU→DG
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants, organizations, users } from './tenant.schema.js';
import { customers } from './customer.schema.js';
import { properties, units } from './property.schema.js';
import { leases } from './lease.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const applicationTypeEnum = pgEnum('application_type', [
  'new_lease',
  'lease_renewal',
  'bareland_lease',
  'transfer',
  'modification',
  'termination',
  'rent_review',
  'other',
]);

export const applicationStatusEnum = pgEnum('application_status', [
  'received',
  'digitized',
  'at_station',
  'routed_to_hq',
  'at_emu',
  'under_review',
  'pending_civil_eng',
  'pending_dg',
  'approved',
  'rejected',
  'returned',
  'withdrawn',
]);

export const applicationAssetTypeEnum = pgEnum('application_asset_type', [
  'building',
  'unit',
  'bareland',
  'portion',
  'other',
]);

// ============================================================================
// Applications Table
// ============================================================================

export const applications = pgTable(
  'applications',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

    // Identity
    applicationNumber: text('application_number').notNull(),
    type: applicationTypeEnum('type').notNull(),
    status: applicationStatusEnum('status').notNull().default('received'),

    // Applicant (may not be a registered customer yet)
    customerId: text('customer_id').references(() => customers.id),
    applicantName: text('applicant_name').notNull(),
    applicantPhone: text('applicant_phone'),
    applicantEmail: text('applicant_email'),
    applicantAddress: text('applicant_address'),

    // Requested asset
    assetType: applicationAssetTypeEnum('asset_type'),
    propertyId: text('property_id').references(() => properties.id),
    unitId: text('unit_id').references(() => units.id),
    parcelId: text('parcel_id'), // FK to land_parcels (avoid circular import)
    subdivisionId: text('subdivision_id'), // FK to parcel_portions
    requestedLocation: text('requested_location'),
    requestedSize: text('requested_size'),

    // Financial
    proposedRentAmount: integer('proposed_rent_amount'), // Minor units (TZS cents)
    currency: text('currency').notNull().default('TZS'),
    proposedLeaseTermMonths: integer('proposed_lease_term_months'),
    purposeOfUse: text('purpose_of_use'),

    // Letter intake
    letterReceivedDate: timestamp('letter_received_date', { withTimezone: true }).notNull(),
    letterReceivedAt: text('letter_received_at').notNull().default('station'), // 'station' | 'hq'
    receivingStationId: text('receiving_station_id').references(() => organizations.id),
    digitalLetterUrl: text('digital_letter_url'), // Scanned/uploaded letter
    digitalizedContent: text('digitalized_content'), // OCR'd content
    additionalDocumentUrls: jsonb('additional_document_urls').default([]),

    // Routing & assignment
    currentAssigneeId: text('current_assignee_id').references(() => users.id),
    currentOrganizationId: text('current_organization_id').references(() => organizations.id),
    forwardedToHqAt: timestamp('forwarded_to_hq_at', { withTimezone: true }),
    receivedAtHqAt: timestamp('received_at_hq_at', { withTimezone: true }),
    assignedToEmuAt: timestamp('assigned_to_emu_at', { withTimezone: true }),

    // Civil Engineering review (for barelands near railway reserve)
    requiresCivilEngReview: boolean('requires_civil_eng_review').notNull().default(false),
    civilEngNotifiedAt: timestamp('civil_eng_notified_at', { withTimezone: true }),
    civilEngApprovedAt: timestamp('civil_eng_approved_at', { withTimezone: true }),
    civilEngApprovedBy: text('civil_eng_approved_by'),
    civilEngNotes: text('civil_eng_notes'),

    // EMU review
    emuReviewedAt: timestamp('emu_reviewed_at', { withTimezone: true }),
    emuReviewedBy: text('emu_reviewed_by'),
    emuNotes: text('emu_notes'),

    // DG approval (required when rent >= 500k TZS/month)
    requiresDgApproval: boolean('requires_dg_approval').notNull().default(false),
    dgApprovedAt: timestamp('dg_approved_at', { withTimezone: true }),
    dgApprovedBy: text('dg_approved_by'),
    dgNotes: text('dg_notes'),

    // Final decision
    finalDecision: text('final_decision'), // 'approved' | 'rejected'
    finalDecisionAt: timestamp('final_decision_at', { withTimezone: true }),
    finalDecisionBy: text('final_decision_by'),
    finalDecisionNotes: text('final_decision_notes'),

    // Resulting lease (after approval)
    resultingLeaseId: text('resulting_lease_id').references(() => leases.id),

    // Response
    responseLetterUrl: text('response_letter_url'),
    responseDate: timestamp('response_date', { withTimezone: true }),

    // Notes
    internalNotes: text('internal_notes'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('applications_tenant_idx').on(table.tenantId),
    numberTenantIdx: uniqueIndex('applications_number_tenant_idx').on(table.tenantId, table.applicationNumber),
    statusIdx: index('applications_status_idx').on(table.status),
    typeIdx: index('applications_type_idx').on(table.type),
    customerIdx: index('applications_customer_idx').on(table.customerId),
    assigneeIdx: index('applications_assignee_idx').on(table.currentAssigneeId),
    currentOrgIdx: index('applications_current_org_idx').on(table.currentOrganizationId),
    receivedDateIdx: index('applications_received_date_idx').on(table.letterReceivedDate),
    stationIdx: index('applications_station_idx').on(table.receivingStationId),
  })
);

// ============================================================================
// Application Routing History Table
// ============================================================================

export const applicationRoutingHistory = pgTable(
  'application_routing_history',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),

    // Routing
    fromOrganizationId: text('from_organization_id').references(() => organizations.id),
    toOrganizationId: text('to_organization_id').references(() => organizations.id),
    fromUserId: text('from_user_id').references(() => users.id),
    toUserId: text('to_user_id').references(() => users.id),

    // Action
    action: text('action').notNull(), // 'submitted', 'forwarded', 'assigned', 'returned', 'escalated', 'approved', 'rejected'
    notes: text('notes'),

    // Timestamps
    routedAt: timestamp('routed_at', { withTimezone: true }).notNull().defaultNow(),
    routedBy: text('routed_by'),
  },
  (table) => ({
    tenantIdx: index('app_routing_tenant_idx').on(table.tenantId),
    applicationIdx: index('app_routing_application_idx').on(table.applicationId),
    routedAtIdx: index('app_routing_routed_at_idx').on(table.routedAt),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [applications.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [applications.customerId],
    references: [customers.id],
  }),
  property: one(properties, {
    fields: [applications.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [applications.unitId],
    references: [units.id],
  }),
  receivingStation: one(organizations, {
    fields: [applications.receivingStationId],
    references: [organizations.id],
    relationName: 'receivingStation',
  }),
  currentOrganization: one(organizations, {
    fields: [applications.currentOrganizationId],
    references: [organizations.id],
    relationName: 'currentOrg',
  }),
  currentAssignee: one(users, {
    fields: [applications.currentAssigneeId],
    references: [users.id],
  }),
  resultingLease: one(leases, {
    fields: [applications.resultingLeaseId],
    references: [leases.id],
  }),
  routingHistory: many(applicationRoutingHistory),
}));

export const applicationRoutingHistoryRelations = relations(applicationRoutingHistory, ({ one }) => ({
  tenant: one(tenants, {
    fields: [applicationRoutingHistory.tenantId],
    references: [tenants.id],
  }),
  application: one(applications, {
    fields: [applicationRoutingHistory.applicationId],
    references: [applications.id],
  }),
  fromOrganization: one(organizations, {
    fields: [applicationRoutingHistory.fromOrganizationId],
    references: [organizations.id],
    relationName: 'fromOrg',
  }),
  toOrganization: one(organizations, {
    fields: [applicationRoutingHistory.toOrganizationId],
    references: [organizations.id],
    relationName: 'toOrg',
  }),
}));
