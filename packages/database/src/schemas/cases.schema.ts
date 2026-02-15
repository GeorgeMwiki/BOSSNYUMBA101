/**
 * Cases Schema
 * Dispute resolution, case management, evidence tracking
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
import { tenants } from './tenant.schema.js';
import { properties, units } from './property.schema.js';
import { customers } from './customer.schema.js';
import { leases } from './lease.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const caseTypeEnum = pgEnum('case_type', [
  'arrears',
  'deposit_dispute',
  'damage_claim',
  'lease_violation',
  'noise_complaint',
  'maintenance_dispute',
  'eviction',
  'harassment',
  'safety_concern',
  'billing_dispute',
  'other',
]);

export const caseSeverityEnum = pgEnum('case_severity', [
  'low',
  'medium',
  'high',
  'critical',
  'urgent',
]);

export const caseStatusEnum = pgEnum('case_status', [
  'open',
  'investigating',
  'pending_response',
  'pending_evidence',
  'mediation',
  'escalated',
  'resolved',
  'closed',
  'withdrawn',
]);

export const timelineEventTypeEnum = pgEnum('timeline_event_type', [
  'case_created',
  'status_changed',
  'evidence_added',
  'note_added',
  'notice_sent',
  'response_received',
  'escalated',
  'assigned',
  'resolution_proposed',
  'resolution_accepted',
  'resolution_rejected',
  'closed',
]);

export const resolutionTypeEnum = pgEnum('resolution_type', [
  'payment_plan',
  'partial_payment',
  'full_payment',
  'deposit_deduction',
  'mutual_agreement',
  'mediation_outcome',
  'court_order',
  'eviction',
  'lease_termination',
  'warning_issued',
  'no_action',
  'withdrawn',
  'other',
]);

export const evidenceTypeEnum = pgEnum('evidence_type', [
  'document',
  'photo',
  'video',
  'audio',
  'communication_log',
  'payment_record',
  'inspection_report',
  'witness_statement',
  'legal_document',
  'other',
]);

// ============================================================================
// Cases Table
// ============================================================================

export const cases = pgTable(
  'cases',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').references(() => properties.id, { onDelete: 'set null' }),
    unitId: text('unit_id').references(() => units.id, { onDelete: 'set null' }),
    customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    leaseId: text('lease_id').references(() => leases.id, { onDelete: 'set null' }),
    
    // Identity
    caseNumber: text('case_number').notNull(),
    
    // Classification
    caseType: caseTypeEnum('case_type').notNull(),
    severity: caseSeverityEnum('severity').notNull().default('medium'),
    status: caseStatusEnum('status').notNull().default('open'),
    
    // Details
    title: text('title').notNull(),
    description: text('description'),
    
    // Financial (for arrears/billing disputes)
    amountInDispute: integer('amount_in_dispute'),
    currency: text('currency').default('KES'),
    
    // SLA
    responseDueAt: timestamp('response_due_at', { withTimezone: true }),
    resolutionDueAt: timestamp('resolution_due_at', { withTimezone: true }),
    slaBreached: boolean('sla_breached').notNull().default(false),
    
    // Assignment
    assignedTo: text('assigned_to'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    assignedBy: text('assigned_by'),
    
    // Escalation
    escalatedAt: timestamp('escalated_at', { withTimezone: true }),
    escalatedTo: text('escalated_to'),
    escalationReason: text('escalation_reason'),
    escalationLevel: integer('escalation_level').default(0),
    
    // Related case (for follow-up cases)
    parentCaseId: text('parent_case_id'),
    
    // Tags
    tags: jsonb('tags').default([]),
    
    // Resolution
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: text('resolved_by'),
    
    // Closure
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedBy: text('closed_by'),
    closureReason: text('closure_reason'),
    
    // Customer satisfaction
    customerSatisfactionRating: integer('customer_satisfaction_rating'),
    customerFeedback: text('customer_feedback'),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('cases_tenant_idx').on(table.tenantId),
    caseNumberTenantIdx: uniqueIndex('cases_case_number_tenant_idx').on(table.tenantId, table.caseNumber),
    propertyIdx: index('cases_property_idx').on(table.propertyId),
    unitIdx: index('cases_unit_idx').on(table.unitId),
    customerIdx: index('cases_customer_idx').on(table.customerId),
    leaseIdx: index('cases_lease_idx').on(table.leaseId),
    typeIdx: index('cases_type_idx').on(table.caseType),
    severityIdx: index('cases_severity_idx').on(table.severity),
    statusIdx: index('cases_status_idx').on(table.status),
    assignedToIdx: index('cases_assigned_to_idx').on(table.assignedTo),
    resolutionDueAtIdx: index('cases_resolution_due_at_idx').on(table.resolutionDueAt),
  })
);

// ============================================================================
// Case Timelines Table
// ============================================================================

export const caseTimelines = pgTable(
  'case_timelines',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    caseId: text('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
    
    // Event
    eventType: timelineEventTypeEnum('event_type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    
    // Before/After state (for status changes)
    previousValue: jsonb('previous_value'),
    newValue: jsonb('new_value'),
    
    // Actor
    actorId: text('actor_id'),
    actorName: text('actor_name'),
    actorType: text('actor_type').default('user'),
    
    // Visibility
    isInternal: boolean('is_internal').notNull().default(false),
    isCustomerVisible: boolean('is_customer_visible').notNull().default(true),
    
    // Attachments
    attachments: jsonb('attachments').default([]),
    
    // Timestamp (immutable)
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('case_timelines_tenant_idx').on(table.tenantId),
    caseIdx: index('case_timelines_case_idx').on(table.caseId),
    eventTypeIdx: index('case_timelines_event_type_idx').on(table.eventType),
    occurredAtIdx: index('case_timelines_occurred_at_idx').on(table.caseId, table.occurredAt),
  })
);

// ============================================================================
// Evidence Attachments Table
// ============================================================================

export const evidenceAttachments = pgTable(
  'evidence_attachments',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    caseId: text('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
    
    // Evidence info
    evidenceType: evidenceTypeEnum('evidence_type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    
    // File info
    fileUrl: text('file_url').notNull(),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size').notNull(),
    mimeType: text('mime_type').notNull(),
    
    // Source document reference
    documentUploadId: text('document_upload_id'),
    
    // Integrity
    checksum: text('checksum'),
    
    // Metadata
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    capturedBy: text('captured_by'),
    location: jsonb('location').default({}),
    metadata: jsonb('metadata').default({}),
    
    // Verification
    verified: boolean('verified').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: text('verified_by'),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('evidence_attachments_tenant_idx').on(table.tenantId),
    caseIdx: index('evidence_attachments_case_idx').on(table.caseId),
    evidenceTypeIdx: index('evidence_attachments_evidence_type_idx').on(table.evidenceType),
  })
);

// ============================================================================
// Case Resolutions Table
// ============================================================================

export const caseResolutions = pgTable(
  'case_resolutions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    caseId: text('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
    
    // Resolution type
    resolutionType: resolutionTypeEnum('resolution_type').notNull(),
    
    // Details
    summary: text('summary').notNull(),
    details: text('details'),
    
    // Financial resolution
    amountResolved: integer('amount_resolved'),
    amountWaived: integer('amount_waived'),
    currency: text('currency').default('KES'),
    
    // Payment plan (if applicable)
    paymentPlanId: text('payment_plan_id'),
    
    // Terms
    terms: jsonb('terms').default({}),
    conditions: jsonb('conditions').default([]),
    
    // Agreement
    agreementDocumentUrl: text('agreement_document_url'),
    
    // Customer acceptance
    customerAcceptedAt: timestamp('customer_accepted_at', { withTimezone: true }),
    customerAcceptanceMethod: text('customer_acceptance_method'),
    customerSignatureUrl: text('customer_signature_url'),
    
    // Manager approval
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by'),
    
    // Status
    status: text('status').notNull().default('proposed'),
    
    // Timestamps
    proposedAt: timestamp('proposed_at', { withTimezone: true }).notNull().defaultNow(),
    proposedBy: text('proposed_by'),
    effectiveAt: timestamp('effective_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('case_resolutions_tenant_idx').on(table.tenantId),
    caseIdx: index('case_resolutions_case_idx').on(table.caseId),
    resolutionTypeIdx: index('case_resolutions_resolution_type_idx').on(table.resolutionType),
    statusIdx: index('case_resolutions_status_idx').on(table.status),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const casesRelations = relations(cases, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [cases.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [cases.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [cases.unitId],
    references: [units.id],
  }),
  customer: one(customers, {
    fields: [cases.customerId],
    references: [customers.id],
  }),
  lease: one(leases, {
    fields: [cases.leaseId],
    references: [leases.id],
  }),
  parentCase: one(cases, {
    fields: [cases.parentCaseId],
    references: [cases.id],
    relationName: 'caseHierarchy',
  }),
  childCases: many(cases, { relationName: 'caseHierarchy' }),
  timelines: many(caseTimelines),
  evidenceAttachments: many(evidenceAttachments),
  resolutions: many(caseResolutions),
}));

export const caseTimelinesRelations = relations(caseTimelines, ({ one }) => ({
  tenant: one(tenants, {
    fields: [caseTimelines.tenantId],
    references: [tenants.id],
  }),
  case: one(cases, {
    fields: [caseTimelines.caseId],
    references: [cases.id],
  }),
}));

export const evidenceAttachmentsRelations = relations(evidenceAttachments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [evidenceAttachments.tenantId],
    references: [tenants.id],
  }),
  case: one(cases, {
    fields: [evidenceAttachments.caseId],
    references: [cases.id],
  }),
}));

export const caseResolutionsRelations = relations(caseResolutions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [caseResolutions.tenantId],
    references: [tenants.id],
  }),
  case: one(cases, {
    fields: [caseResolutions.caseId],
    references: [cases.id],
  }),
}));

// ============================================================================
// Additional Enums for Notices
// ============================================================================

export const noticeTypeEnum = pgEnum('notice_type', [
  'payment_reminder',
  'payment_demand',
  'late_fee_notice',
  'lease_violation',
  'noise_warning',
  'inspection_notice',
  'entry_notice',
  'renewal_offer',
  'non_renewal',
  'termination',
  'eviction_warning',
  'eviction_notice',
  'deposit_deduction',
  'move_out_instructions',
  'legal_demand',
  'court_summons',
  'other',
]);

export const noticeStatusEnum = pgEnum('notice_status', [
  'draft',
  'pending_approval',
  'approved',
  'scheduled',
  'sent',
  'delivered',
  'acknowledged',
  'expired',
  'cancelled',
  'voided',
]);

export const deliveryMethodEnum = pgEnum('delivery_method', [
  'email',
  'sms',
  'whatsapp',
  'in_app',
  'physical_mail',
  'hand_delivery',
  'courier',
  'posted_on_door',
]);

// ============================================================================
// Notices Table (Legal notices with approval gates)
// ============================================================================

export const notices = pgTable(
  'notices',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').references(() => properties.id, { onDelete: 'set null' }),
    unitId: text('unit_id').references(() => units.id, { onDelete: 'set null' }),
    customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    leaseId: text('lease_id').references(() => leases.id, { onDelete: 'set null' }),
    caseId: text('case_id').references(() => cases.id, { onDelete: 'set null' }),
    
    // Identity
    noticeNumber: text('notice_number').notNull(),
    
    // Type & Status
    noticeType: noticeTypeEnum('notice_type').notNull(),
    status: noticeStatusEnum('status').notNull().default('draft'),
    
    // Content
    subject: text('subject').notNull(),
    content: text('content').notNull(),
    templateId: text('template_id'),
    templateVersion: integer('template_version'),
    
    // Variables used
    variables: jsonb('variables').default({}),
    
    // Amounts (for financial notices)
    amountDue: integer('amount_due'),
    currency: text('currency').default('KES'),
    
    // Dates
    effectiveDate: timestamp('effective_date', { withTimezone: true }),
    expiryDate: timestamp('expiry_date', { withTimezone: true }),
    responseDeadline: timestamp('response_deadline', { withTimezone: true }),
    
    // Notice period
    noticePeriodDays: integer('notice_period_days'),
    
    // Legal compliance
    jurisdictionCode: text('jurisdiction_code'),
    legalCitations: jsonb('legal_citations').default([]),
    
    // Approval workflow
    requiresApproval: boolean('requires_approval').notNull().default(false),
    approvalLevel: text('approval_level'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by'),
    approvalNotes: text('approval_notes'),
    
    // Rejection
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectedBy: text('rejected_by'),
    rejectionReason: text('rejection_reason'),
    
    // Scheduling
    scheduledSendAt: timestamp('scheduled_send_at', { withTimezone: true }),
    
    // Sending
    sentAt: timestamp('sent_at', { withTimezone: true }),
    sentBy: text('sent_by'),
    sentVia: deliveryMethodEnum('sent_via'),
    
    // Document
    documentUrl: text('document_url'),
    documentHash: text('document_hash'),
    
    // Attachments
    attachments: jsonb('attachments').default([]),
    
    // Acknowledgment
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgmentMethod: text('acknowledgment_method'),
    
    // Voiding
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedBy: text('voided_by'),
    voidReason: text('void_reason'),
    
    // Follow-up
    followUpRequired: boolean('follow_up_required').default(false),
    followUpDueAt: timestamp('follow_up_due_at', { withTimezone: true }),
    
    // Metadata
    metadata: jsonb('metadata').default({}),
    
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
    noticeNumberTenantIdx: uniqueIndex('notices_notice_number_tenant_idx').on(table.tenantId, table.noticeNumber),
    propertyIdx: index('notices_property_idx').on(table.propertyId),
    unitIdx: index('notices_unit_idx').on(table.unitId),
    customerIdx: index('notices_customer_idx').on(table.customerId),
    leaseIdx: index('notices_lease_idx').on(table.leaseId),
    caseIdx: index('notices_case_idx').on(table.caseId),
    noticeTypeIdx: index('notices_notice_type_idx').on(table.noticeType),
    statusIdx: index('notices_status_idx').on(table.status),
    effectiveDateIdx: index('notices_effective_date_idx').on(table.effectiveDate),
    scheduledSendAtIdx: index('notices_scheduled_send_at_idx').on(table.scheduledSendAt),
  })
);

// ============================================================================
// Notice Service Receipts Table (Proof of delivery)
// ============================================================================

export const noticeServiceReceipts = pgTable(
  'notice_service_receipts',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    noticeId: text('notice_id').notNull().references(() => notices.id, { onDelete: 'cascade' }),
    
    // Delivery attempt
    attemptNumber: integer('attempt_number').notNull().default(1),
    
    // Method
    deliveryMethod: deliveryMethodEnum('delivery_method').notNull(),
    
    // Recipient
    recipientName: text('recipient_name'),
    recipientAddress: text('recipient_address'),
    recipientPhone: text('recipient_phone'),
    recipientEmail: text('recipient_email'),
    
    // Status
    wasDelivered: boolean('was_delivered').notNull(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    
    // For physical delivery
    deliveredToName: text('delivered_to_name'),
    deliveredToRelationship: text('delivered_to_relationship'),
    signatureUrl: text('signature_url'),
    photoProofUrls: jsonb('photo_proof_urls').default([]),
    
    // For electronic delivery
    providerMessageId: text('provider_message_id'),
    providerResponse: jsonb('provider_response').default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    
    // For posted delivery
    postedLocation: text('posted_location'),
    witnessName: text('witness_name'),
    witnessPhone: text('witness_phone'),
    
    // Tracking
    trackingNumber: text('tracking_number'),
    carrierName: text('carrier_name'),
    
    // Failure details
    failedAt: timestamp('failed_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    failureCode: text('failure_code'),
    
    // GPS coordinates (for physical delivery)
    deliveryLatitude: decimal('delivery_latitude', { precision: 10, scale: 8 }),
    deliveryLongitude: decimal('delivery_longitude', { precision: 11, scale: 8 }),
    
    // Notes
    deliveryNotes: text('delivery_notes'),
    
    // Verification
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: text('verified_by'),
    
    // Timestamps
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
  },
  (table) => ({
    tenantIdx: index('notice_service_receipts_tenant_idx').on(table.tenantId),
    noticeIdx: index('notice_service_receipts_notice_idx').on(table.noticeId),
    deliveryMethodIdx: index('notice_service_receipts_delivery_method_idx').on(table.deliveryMethod),
    wasDeliveredIdx: index('notice_service_receipts_was_delivered_idx').on(table.wasDelivered),
    attemptedAtIdx: index('notice_service_receipts_attempted_at_idx').on(table.attemptedAt),
  })
);

// ============================================================================
// Additional Relations for Notices
// ============================================================================

export const noticesRelations = relations(notices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [notices.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [notices.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [notices.unitId],
    references: [units.id],
  }),
  customer: one(customers, {
    fields: [notices.customerId],
    references: [customers.id],
  }),
  lease: one(leases, {
    fields: [notices.leaseId],
    references: [leases.id],
  }),
  case: one(cases, {
    fields: [notices.caseId],
    references: [cases.id],
  }),
  serviceReceipts: many(noticeServiceReceipts),
}));

export const noticeServiceReceiptsRelations = relations(noticeServiceReceipts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [noticeServiceReceipts.tenantId],
    references: [tenants.id],
  }),
  notice: one(notices, {
    fields: [noticeServiceReceipts.noticeId],
    references: [notices.id],
  }),
}));
