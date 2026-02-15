/**
 * Maintenance and Work Order Schemas
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
import { tenants } from './tenant.schema.js';
import { properties, units } from './property.schema.js';
import { customers } from './customer.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const workOrderPriorityEnum = pgEnum('work_order_priority', [
  'low',
  'medium',
  'high',
  'urgent',
  'emergency',
]);

export const workOrderStatusEnum = pgEnum('work_order_status', [
  'submitted',
  'triaged',
  'assigned',
  'scheduled',
  'in_progress',
  'pending_parts',
  'completed',
  'verified',
  'reopened',
  'cancelled',
]);

export const workOrderCategoryEnum = pgEnum('work_order_category', [
  'plumbing',
  'electrical',
  'hvac',
  'appliance',
  'structural',
  'pest_control',
  'landscaping',
  'cleaning',
  'security',
  'other',
]);

export const workOrderSourceEnum = pgEnum('work_order_source', [
  'customer_request',
  'inspection',
  'preventive',
  'emergency',
  'manager_created',
]);

export const vendorStatusEnum = pgEnum('vendor_status', [
  'active',
  'inactive',
  'probation',
  'suspended',
  'blacklisted',
]);

// ============================================================================
// Vendors Table
// ============================================================================

export const vendors = pgTable(
  'vendors',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

    // Identity
    vendorCode: text('vendor_code').notNull(),
    companyName: text('company_name').notNull(),
    status: vendorStatusEnum('status').notNull().default('active'),

    // Capabilities
    specializations: jsonb('specializations').default([]), // e.g. ['plumbing', 'electrical']
    serviceAreas: jsonb('service_areas').default([]), // e.g. ['Kampala', 'Entebbe']
    contacts: jsonb('contacts').default([]), // e.g. [{ type, name, phone, email }]
    rateCards: jsonb('rate_cards').default([]), // e.g. [{ category, rate, unit }]
    performanceMetrics: jsonb('performance_metrics').default({}), // e.g. { avgRating, completionRate }

    // Flags
    isPreferred: boolean('is_preferred').notNull().default(false),
    emergencyAvailable: boolean('emergency_available').notNull().default(false),

    // Compliance
    licenseNumber: text('license_number'),
    insuranceExpiryDate: timestamp('insurance_expiry_date', { withTimezone: true }),

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
    tenantIdx: index('vendors_tenant_idx').on(table.tenantId),
    codeTenantIdx: uniqueIndex('vendors_code_tenant_idx').on(table.tenantId, table.vendorCode),
    statusIdx: index('vendors_status_idx').on(table.status),
    preferredIdx: index('vendors_preferred_idx').on(table.isPreferred),
    emergencyIdx: index('vendors_emergency_idx').on(table.emergencyAvailable),
  })
);

// ============================================================================
// Work Orders Table
// ============================================================================

export const workOrders = pgTable(
  'work_orders',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
    unitId: text('unit_id').references(() => units.id, { onDelete: 'set null' }),
    customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    vendorId: text('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),

    // Identity
    workOrderNumber: text('work_order_number').notNull(),

    // Classification
    priority: workOrderPriorityEnum('priority').notNull().default('medium'),
    status: workOrderStatusEnum('status').notNull().default('submitted'),
    category: workOrderCategoryEnum('category').notNull(),
    source: workOrderSourceEnum('source').notNull().default('customer_request'),

    // Details
    title: text('title').notNull(),
    description: text('description'),
    location: text('location'),
    attachments: jsonb('attachments').default([]), // e.g. [{ url, name, type }]

    // SLA config and tracking
    responseDueAt: timestamp('response_due_at', { withTimezone: true }),
    resolutionDueAt: timestamp('resolution_due_at', { withTimezone: true }),
    responseBreached: boolean('response_breached').notNull().default(false),
    resolutionBreached: boolean('resolution_breached').notNull().default(false),
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    pausedMinutes: integer('paused_minutes').notNull().default(0),

    // Scheduling
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    scheduledStartAt: timestamp('scheduled_start_at', { withTimezone: true }),
    scheduledEndAt: timestamp('scheduled_end_at', { withTimezone: true }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    assignedBy: text('assigned_by'),

    // Cost
    estimatedCost: integer('estimated_cost'), // In minor units
    actualCost: integer('actual_cost'), // In minor units
    currency: text('currency').notNull().default('KES'),

    // Completion
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: text('completed_by'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: text('verified_by'),
    completionNotes: text('completion_notes'),

    // Rating & feedback
    rating: integer('rating'), // 1-5
    feedback: text('feedback'),

    // Timeline (audit trail of status changes)
    timeline: jsonb('timeline').default([]), // e.g. [{ at, status, by, note }]

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('work_orders_tenant_idx').on(table.tenantId),
    numberTenantIdx: uniqueIndex('work_orders_number_tenant_idx').on(table.tenantId, table.workOrderNumber),
    propertyIdx: index('work_orders_property_idx').on(table.propertyId),
    unitIdx: index('work_orders_unit_idx').on(table.unitId),
    customerIdx: index('work_orders_customer_idx').on(table.customerId),
    vendorIdx: index('work_orders_vendor_idx').on(table.vendorId),
    statusIdx: index('work_orders_status_idx').on(table.status),
    priorityIdx: index('work_orders_priority_idx').on(table.priority),
    categoryIdx: index('work_orders_category_idx').on(table.category),
    sourceIdx: index('work_orders_source_idx').on(table.source),
    scheduledAtIdx: index('work_orders_scheduled_at_idx').on(table.scheduledAt),
    responseDueAtIdx: index('work_orders_response_due_at_idx').on(table.responseDueAt),
    resolutionDueAtIdx: index('work_orders_resolution_due_at_idx').on(table.resolutionDueAt),
    createdAtIdx: index('work_orders_created_at_idx').on(table.createdAt),
  })
);

// ============================================================================
// Vendor Scorecards Table
// ============================================================================

export const vendorScorecards = pgTable(
  'vendor_scorecards',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    vendorId: text('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
    
    // Period (month/year format)
    periodMonth: integer('period_month').notNull(), // 1-12
    periodYear: integer('period_year').notNull(),
    
    // Performance Metrics (scores out of 100 or specific units)
    responseTime: integer('response_time'), // Average response time in minutes
    qualityScore: integer('quality_score'), // 0-100 quality rating
    reopenRate: integer('reopen_rate'), // Percentage of work orders reopened (0-100)
    slaCompliance: integer('sla_compliance'), // SLA compliance percentage (0-100)
    tenantSatisfaction: integer('tenant_satisfaction'), // Satisfaction score (0-100)
    costEfficiency: integer('cost_efficiency'), // Cost efficiency score (0-100)
    
    // Aggregated data
    totalWorkOrders: integer('total_work_orders').notNull().default(0),
    completedWorkOrders: integer('completed_work_orders').notNull().default(0),
    onTimeCompletions: integer('on_time_completions').notNull().default(0),
    averageRating: integer('average_rating'), // Average customer rating (1-5 scaled to 0-100)
    
    // Overall score
    overallScore: integer('overall_score'), // Weighted composite score (0-100)
    
    // Notes
    notes: text('notes'),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('vendor_scorecards_tenant_idx').on(table.tenantId),
    vendorIdx: index('vendor_scorecards_vendor_idx').on(table.vendorId),
    periodIdx: uniqueIndex('vendor_scorecards_vendor_period_idx').on(table.vendorId, table.periodYear, table.periodMonth),
    periodYearIdx: index('vendor_scorecards_period_year_idx').on(table.periodYear, table.periodMonth),
    overallScoreIdx: index('vendor_scorecards_overall_score_idx').on(table.overallScore),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [vendors.tenantId],
    references: [tenants.id],
  }),
  workOrders: many(workOrders),
  scorecards: many(vendorScorecards),
}));

export const vendorScorecardsRelations = relations(vendorScorecards, ({ one }) => ({
  tenant: one(tenants, {
    fields: [vendorScorecards.tenantId],
    references: [tenants.id],
  }),
  vendor: one(vendors, {
    fields: [vendorScorecards.vendorId],
    references: [vendors.id],
  }),
}));

export const workOrdersRelations = relations(workOrders, ({ one }) => ({
  tenant: one(tenants, {
    fields: [workOrders.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [workOrders.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [workOrders.unitId],
    references: [units.id],
  }),
  customer: one(customers, {
    fields: [workOrders.customerId],
    references: [customers.id],
  }),
  vendor: one(vendors, {
    fields: [workOrders.vendorId],
    references: [vendors.id],
  }),
}));

// ============================================================================
// Additional Enums
// ============================================================================

export const maintenanceRequestStatusEnum = pgEnum('maintenance_request_status', [
  'submitted',
  'acknowledged',
  'pending_info',
  'approved',
  'rejected',
  'converted_to_wo',
  'cancelled',
]);

export const dispatchStatusEnum = pgEnum('dispatch_status', [
  'pending',
  'notified',
  'accepted',
  'declined',
  'en_route',
  'arrived',
  'completed',
  'no_show',
  'rescheduled',
]);

export const assetStatusEnum = pgEnum('asset_status', [
  'active',
  'inactive',
  'under_maintenance',
  'retired',
  'disposed',
]);

export const assetConditionEnum = pgEnum('asset_condition', [
  'excellent',
  'good',
  'fair',
  'poor',
  'critical',
]);

// ============================================================================
// Maintenance Requests Table (Pre-Work Order)
// ============================================================================

export const maintenanceRequests = pgTable(
  'maintenance_requests',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').notNull().references(() => properties.id),
    unitId: text('unit_id').references(() => units.id),
    customerId: text('customer_id').references(() => customers.id),
    
    requestNumber: text('request_number').notNull(),
    status: maintenanceRequestStatusEnum('status').notNull().default('submitted'),
    
    // Request details
    title: text('title').notNull(),
    description: text('description'),
    category: workOrderCategoryEnum('category').notNull(),
    
    // AI triage
    aiTriagedAt: timestamp('ai_triaged_at', { withTimezone: true }),
    aiSuggestedPriority: workOrderPriorityEnum('ai_suggested_priority'),
    aiSuggestedCategory: workOrderCategoryEnum('ai_suggested_category'),
    aiConfidenceScore: decimal('ai_confidence_score', { precision: 5, scale: 4 }),
    aiNotes: text('ai_notes'),
    
    // Final priority (after manager review)
    priority: workOrderPriorityEnum('priority'),
    
    // Source
    source: workOrderSourceEnum('source').notNull().default('customer_request'),
    sourceChannel: text('source_channel'),
    
    // Location
    location: text('location'),
    
    // Attachments (photos, voice notes, etc.)
    attachments: jsonb('attachments').default([]),
    voiceNoteUrl: text('voice_note_url'),
    voiceTranscript: text('voice_transcript'),
    
    // Acknowledgment
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: text('acknowledged_by'),
    
    // Approval
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by'),
    approvalNotes: text('approval_notes'),
    
    // Rejection
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectedBy: text('rejected_by'),
    rejectionReason: text('rejection_reason'),
    
    // Conversion to work order
    workOrderId: text('work_order_id'),
    convertedAt: timestamp('converted_at', { withTimezone: true }),
    
    // Customer communication
    customerNotifiedAt: timestamp('customer_notified_at', { withTimezone: true }),
    
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('maintenance_requests_tenant_idx').on(table.tenantId),
    requestNumberTenantIdx: uniqueIndex('maintenance_requests_request_number_tenant_idx').on(table.tenantId, table.requestNumber),
    propertyIdx: index('maintenance_requests_property_idx').on(table.propertyId),
    unitIdx: index('maintenance_requests_unit_idx').on(table.unitId),
    customerIdx: index('maintenance_requests_customer_idx').on(table.customerId),
    statusIdx: index('maintenance_requests_status_idx').on(table.status),
    categoryIdx: index('maintenance_requests_category_idx').on(table.category),
    createdAtIdx: index('maintenance_requests_created_at_idx').on(table.createdAt),
  })
);

// ============================================================================
// Dispatch Events Table
// ============================================================================

export const dispatchEvents = pgTable(
  'dispatch_events',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    workOrderId: text('work_order_id').notNull().references(() => workOrders.id, { onDelete: 'cascade' }),
    vendorId: text('vendor_id').notNull().references(() => vendors.id),
    
    // Status
    status: dispatchStatusEnum('status').notNull().default('pending'),
    
    // Scheduling
    scheduledDate: timestamp('scheduled_date', { withTimezone: true }),
    scheduledStartTime: text('scheduled_start_time'),
    scheduledEndTime: text('scheduled_end_time'),
    
    // Notification
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    notificationChannel: text('notification_channel'),
    
    // Response
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    responseType: text('response_type'),
    declineReason: text('decline_reason'),
    
    // Tracking
    enRouteAt: timestamp('en_route_at', { withTimezone: true }),
    arrivedAt: timestamp('arrived_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    
    // Location tracking
    lastKnownLocation: jsonb('last_known_location').default({}),
    
    // Rescheduling
    rescheduledAt: timestamp('rescheduled_at', { withTimezone: true }),
    rescheduledBy: text('rescheduled_by'),
    rescheduleReason: text('reschedule_reason'),
    originalScheduledDate: timestamp('original_scheduled_date', { withTimezone: true }),
    
    // Notes
    dispatchNotes: text('dispatch_notes'),
    technicianNotes: text('technician_notes'),
    
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('dispatch_events_tenant_idx').on(table.tenantId),
    workOrderIdx: index('dispatch_events_work_order_idx').on(table.workOrderId),
    vendorIdx: index('dispatch_events_vendor_idx').on(table.vendorId),
    statusIdx: index('dispatch_events_status_idx').on(table.status),
    scheduledDateIdx: index('dispatch_events_scheduled_date_idx').on(table.scheduledDate),
  })
);

// ============================================================================
// Completion Proofs Table
// ============================================================================

export const completionProofs = pgTable(
  'completion_proofs',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    workOrderId: text('work_order_id').notNull().references(() => workOrders.id, { onDelete: 'cascade' }),
    
    // Evidence
    beforePhotos: jsonb('before_photos').default([]),
    afterPhotos: jsonb('after_photos').default([]),
    videos: jsonb('videos').default([]),
    
    // Work summary
    workSummary: text('work_summary'),
    partsUsed: jsonb('parts_used').default([]),
    laborHours: decimal('labor_hours', { precision: 5, scale: 2 }),
    
    // Materials
    materialsUsed: jsonb('materials_used').default([]),
    defectsReturned: jsonb('defects_returned').default([]),
    
    // Costs
    laborCost: integer('labor_cost'),
    materialsCost: integer('materials_cost'),
    totalCost: integer('total_cost'),
    currency: text('currency').default('KES'),
    
    // Technician details
    technicianId: text('technician_id'),
    technicianName: text('technician_name'),
    technicianSignature: text('technician_signature'),
    technicianSignedAt: timestamp('technician_signed_at', { withTimezone: true }),
    
    // Location verification
    completionLocation: jsonb('completion_location').default({}),
    
    // Timestamps
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('completion_proofs_tenant_idx').on(table.tenantId),
    workOrderIdx: uniqueIndex('completion_proofs_work_order_idx').on(table.workOrderId),
    submittedAtIdx: index('completion_proofs_submitted_at_idx').on(table.submittedAt),
  })
);

// ============================================================================
// Dual Sign-offs Table
// ============================================================================

export const dualSignoffs = pgTable(
  'dual_signoffs',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    workOrderId: text('work_order_id').notNull().references(() => workOrders.id, { onDelete: 'cascade' }),
    completionProofId: text('completion_proof_id').references(() => completionProofs.id),
    
    // Technician sign-off
    technicianSignedAt: timestamp('technician_signed_at', { withTimezone: true }),
    technicianName: text('technician_name'),
    technicianSignature: text('technician_signature'),
    technicianComments: text('technician_comments'),
    
    // Customer sign-off
    customerSignedAt: timestamp('customer_signed_at', { withTimezone: true }),
    customerName: text('customer_name'),
    customerSignature: text('customer_signature'),
    customerComments: text('customer_comments'),
    customerSatisfied: boolean('customer_satisfied'),
    
    // If customer refuses to sign
    customerRefused: boolean('customer_refused').default(false),
    refusalReason: text('refusal_reason'),
    
    // Verification
    isComplete: boolean('is_complete').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    
    // Follow-up needed
    followUpRequired: boolean('follow_up_required').default(false),
    followUpNotes: text('follow_up_notes'),
    
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('dual_signoffs_tenant_idx').on(table.tenantId),
    workOrderIdx: uniqueIndex('dual_signoffs_work_order_idx').on(table.workOrderId),
    isCompleteIdx: index('dual_signoffs_is_complete_idx').on(table.isComplete),
  })
);

// ============================================================================
// Assets Table (Digital Twin)
// ============================================================================

export const assets = pgTable(
  'assets',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').notNull().references(() => properties.id),
    unitId: text('unit_id').references(() => units.id),
    
    // Identity
    assetCode: text('asset_code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    
    // Classification
    category: text('category').notNull(),
    subcategory: text('subcategory'),
    
    // Status
    status: assetStatusEnum('status').notNull().default('active'),
    condition: assetConditionEnum('condition').notNull().default('good'),
    
    // Location
    location: text('location'),
    room: text('room'),
    
    // Specifications
    manufacturer: text('manufacturer'),
    model: text('model'),
    serialNumber: text('serial_number'),
    specifications: jsonb('specifications').default({}),
    
    // Purchase info
    purchaseDate: timestamp('purchase_date', { withTimezone: true }),
    purchasePrice: integer('purchase_price'),
    purchaseCurrency: text('purchase_currency').default('KES'),
    supplier: text('supplier'),
    warrantyExpiresAt: timestamp('warranty_expires_at', { withTimezone: true }),
    
    // Lifecycle
    expectedLifespanYears: integer('expected_lifespan_years'),
    installationDate: timestamp('installation_date', { withTimezone: true }),
    lastMaintenanceDate: timestamp('last_maintenance_date', { withTimezone: true }),
    nextMaintenanceDue: timestamp('next_maintenance_due', { withTimezone: true }),
    
    // Maintenance schedule
    maintenanceSchedule: jsonb('maintenance_schedule').default({}),
    maintenanceHistory: jsonb('maintenance_history').default([]),
    
    // Current value
    currentValue: integer('current_value'),
    depreciationMethod: text('depreciation_method'),
    
    // Photos
    photos: jsonb('photos').default([]),
    
    // QR/Barcode
    qrCode: text('qr_code'),
    barcode: text('barcode'),
    
    // Disposal
    disposedAt: timestamp('disposed_at', { withTimezone: true }),
    disposedBy: text('disposed_by'),
    disposalMethod: text('disposal_method'),
    disposalValue: integer('disposal_value'),
    
    // Notes
    notes: text('notes'),
    
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('assets_tenant_idx').on(table.tenantId),
    assetCodeTenantIdx: uniqueIndex('assets_asset_code_tenant_idx').on(table.tenantId, table.assetCode),
    propertyIdx: index('assets_property_idx').on(table.propertyId),
    unitIdx: index('assets_unit_idx').on(table.unitId),
    categoryIdx: index('assets_category_idx').on(table.category),
    statusIdx: index('assets_status_idx').on(table.status),
    conditionIdx: index('assets_condition_idx').on(table.condition),
    nextMaintenanceDueIdx: index('assets_next_maintenance_due_idx').on(table.nextMaintenanceDue),
  })
);

// ============================================================================
// Vendor Scorecards Table
// ============================================================================

export const vendorScorecards = pgTable(
  'vendor_scorecards',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    vendorId: text('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
    
    // Period
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    
    // Metrics
    totalJobs: integer('total_jobs').notNull().default(0),
    completedJobs: integer('completed_jobs').notNull().default(0),
    cancelledJobs: integer('cancelled_jobs').notNull().default(0),
    
    // Quality
    avgRating: decimal('avg_rating', { precision: 3, scale: 2 }),
    ratingCount: integer('rating_count').default(0),
    firstTimeFixRate: decimal('first_time_fix_rate', { precision: 5, scale: 2 }),
    
    // Timeliness
    onTimeArrivalRate: decimal('on_time_arrival_rate', { precision: 5, scale: 2 }),
    avgResponseTimeMinutes: integer('avg_response_time_minutes'),
    slaComplianceRate: decimal('sla_compliance_rate', { precision: 5, scale: 2 }),
    
    // Cost
    avgJobCost: integer('avg_job_cost'),
    costVariance: decimal('cost_variance', { precision: 5, scale: 2 }),
    
    // Communication
    communicationScore: decimal('communication_score', { precision: 3, scale: 2 }),
    
    // Complaints
    complaintCount: integer('complaint_count').default(0),
    resolvedComplaints: integer('resolved_complaints').default(0),
    
    // Overall
    overallScore: decimal('overall_score', { precision: 5, scale: 2 }),
    trend: text('trend'),
    
    // Recommendations
    recommendations: jsonb('recommendations').default([]),
    
    // Status
    isLatest: boolean('is_latest').notNull().default(true),
    
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('vendor_scorecards_tenant_idx').on(table.tenantId),
    vendorIdx: index('vendor_scorecards_vendor_idx').on(table.vendorId),
    periodIdx: index('vendor_scorecards_period_idx').on(table.periodStart, table.periodEnd),
    latestIdx: index('vendor_scorecards_latest_idx').on(table.vendorId, table.isLatest),
    overallScoreIdx: index('vendor_scorecards_overall_score_idx').on(table.overallScore),
  })
);

// ============================================================================
// Vendor Assignments Table
// ============================================================================

export const vendorAssignments = pgTable(
  'vendor_assignments',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    vendorId: text('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').references(() => properties.id),
    
    // Assignment type
    assignmentType: text('assignment_type').notNull(),
    category: workOrderCategoryEnum('category'),
    
    // Status
    isActive: boolean('is_active').notNull().default(true),
    
    // Priority
    priority: integer('priority').default(0),
    isPreferred: boolean('is_preferred').default(false),
    
    // Coverage
    coverageArea: jsonb('coverage_area').default([]),
    
    // Rate
    agreedRate: integer('agreed_rate'),
    rateType: text('rate_type'),
    rateCurrency: text('rate_currency').default('KES'),
    
    // Availability
    availableDays: jsonb('available_days').default([]),
    availableHours: jsonb('available_hours').default({}),
    emergencyAvailable: boolean('emergency_available').default(false),
    
    // Contract
    contractStart: timestamp('contract_start', { withTimezone: true }),
    contractEnd: timestamp('contract_end', { withTimezone: true }),
    
    // Performance
    jobsCompleted: integer('jobs_completed').default(0),
    avgRating: decimal('avg_rating', { precision: 3, scale: 2 }),
    
    // Notes
    notes: text('notes'),
    
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('vendor_assignments_tenant_idx').on(table.tenantId),
    vendorIdx: index('vendor_assignments_vendor_idx').on(table.vendorId),
    propertyIdx: index('vendor_assignments_property_idx').on(table.propertyId),
    categoryIdx: index('vendor_assignments_category_idx').on(table.category),
    isActiveIdx: index('vendor_assignments_is_active_idx').on(table.isActive),
    preferredIdx: index('vendor_assignments_preferred_idx').on(table.isPreferred),
  })
);

// ============================================================================
// Additional Relations
// ============================================================================

export const maintenanceRequestsRelations = relations(maintenanceRequests, ({ one }) => ({
  tenant: one(tenants, {
    fields: [maintenanceRequests.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [maintenanceRequests.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [maintenanceRequests.unitId],
    references: [units.id],
  }),
  customer: one(customers, {
    fields: [maintenanceRequests.customerId],
    references: [customers.id],
  }),
  workOrder: one(workOrders, {
    fields: [maintenanceRequests.workOrderId],
    references: [workOrders.id],
  }),
}));

export const dispatchEventsRelations = relations(dispatchEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [dispatchEvents.tenantId],
    references: [tenants.id],
  }),
  workOrder: one(workOrders, {
    fields: [dispatchEvents.workOrderId],
    references: [workOrders.id],
  }),
  vendor: one(vendors, {
    fields: [dispatchEvents.vendorId],
    references: [vendors.id],
  }),
}));

export const completionProofsRelations = relations(completionProofs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [completionProofs.tenantId],
    references: [tenants.id],
  }),
  workOrder: one(workOrders, {
    fields: [completionProofs.workOrderId],
    references: [workOrders.id],
  }),
}));

export const dualSignoffsRelations = relations(dualSignoffs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [dualSignoffs.tenantId],
    references: [tenants.id],
  }),
  workOrder: one(workOrders, {
    fields: [dualSignoffs.workOrderId],
    references: [workOrders.id],
  }),
  completionProof: one(completionProofs, {
    fields: [dualSignoffs.completionProofId],
    references: [completionProofs.id],
  }),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  tenant: one(tenants, {
    fields: [assets.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [assets.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [assets.unitId],
    references: [units.id],
  }),
}));

export const vendorScorecardsRelations = relations(vendorScorecards, ({ one }) => ({
  tenant: one(tenants, {
    fields: [vendorScorecards.tenantId],
    references: [tenants.id],
  }),
  vendor: one(vendors, {
    fields: [vendorScorecards.vendorId],
    references: [vendors.id],
  }),
}));

export const vendorAssignmentsRelations = relations(vendorAssignments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [vendorAssignments.tenantId],
    references: [tenants.id],
  }),
  vendor: one(vendors, {
    fields: [vendorAssignments.vendorId],
    references: [vendors.id],
  }),
  property: one(properties, {
    fields: [vendorAssignments.propertyId],
    references: [properties.id],
  }),
}));
