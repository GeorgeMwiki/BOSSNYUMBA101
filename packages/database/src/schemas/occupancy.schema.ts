/**
 * Occupancy Schema
 * Active tenure records of customers in units
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
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

export const occupancyStatusEnum = pgEnum('occupancy_status', [
  'pending_move_in',
  'active',
  'notice_given',
  'pending_move_out',
  'moved_out',
  'evicted',
  'abandoned',
]);

export const onboardingStateEnum = pgEnum('onboarding_state', [
  'a0_pre_move_in',
  'a1_welcome_setup',
  'a2_utilities',
  'a3_orientation',
  'a4_condition_report',
  'a5_community_context',
  'a6_complete',
]);

// ============================================================================
// Occupancies Table
// ============================================================================

export const occupancies = pgTable(
  'occupancies',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').notNull().references(() => properties.id),
    unitId: text('unit_id').notNull().references(() => units.id),
    customerId: text('customer_id').notNull().references(() => customers.id),
    leaseId: text('lease_id').notNull().references(() => leases.id),
    
    // Status
    status: occupancyStatusEnum('status').notNull().default('pending_move_in'),
    
    // Onboarding state machine
    onboardingState: onboardingStateEnum('onboarding_state').notNull().default('a0_pre_move_in'),
    onboardingStartedAt: timestamp('onboarding_started_at', { withTimezone: true }),
    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
    onboardingChecklist: jsonb('onboarding_checklist').default({}),
    
    // Move-in
    scheduledMoveInDate: timestamp('scheduled_move_in_date', { withTimezone: true }),
    actualMoveInDate: timestamp('actual_move_in_date', { withTimezone: true }),
    moveInInspectionId: text('move_in_inspection_id'),
    moveInConditionReport: jsonb('move_in_condition_report').default({}),
    
    // Move-out
    noticeGivenDate: timestamp('notice_given_date', { withTimezone: true }),
    scheduledMoveOutDate: timestamp('scheduled_move_out_date', { withTimezone: true }),
    actualMoveOutDate: timestamp('actual_move_out_date', { withTimezone: true }),
    moveOutInspectionId: text('move_out_inspection_id'),
    moveOutConditionReport: jsonb('move_out_condition_report').default({}),
    
    // Keys and access
    keysHandedOver: boolean('keys_handed_over').notNull().default(false),
    keysHandedOverAt: timestamp('keys_handed_over_at', { withTimezone: true }),
    keysReturnedAt: timestamp('keys_returned_at', { withTimezone: true }),
    accessCodes: jsonb('access_codes').default([]),
    
    // Meter readings
    meterReadingsAtMoveIn: jsonb('meter_readings_at_move_in').default({}),
    meterReadingsAtMoveOut: jsonb('meter_readings_at_move_out').default({}),
    
    // Occupants
    primaryOccupant: jsonb('primary_occupant').default({}),
    additionalOccupants: jsonb('additional_occupants').default([]),
    totalOccupants: integer('total_occupants').default(1),
    
    // Pets
    hasPets: boolean('has_pets').notNull().default(false),
    petDetails: jsonb('pet_details').default([]),
    
    // Vehicles
    vehicles: jsonb('vehicles').default([]),
    parkingAssignment: text('parking_assignment'),
    
    // Emergency contacts
    emergencyContacts: jsonb('emergency_contacts').default([]),
    
    // Welcome pack
    welcomePackSentAt: timestamp('welcome_pack_sent_at', { withTimezone: true }),
    welcomePackAcknowledgedAt: timestamp('welcome_pack_acknowledged_at', { withTimezone: true }),
    
    // Check-ins
    lastCheckInAt: timestamp('last_check_in_at', { withTimezone: true }),
    nextCheckInDue: timestamp('next_check_in_due', { withTimezone: true }),
    checkInCount: integer('check_in_count').default(0),
    
    // Badge
    onboardingBadgeAwarded: boolean('onboarding_badge_awarded').notNull().default(false),
    onboardingBadgeAwardedAt: timestamp('onboarding_badge_awarded_at', { withTimezone: true }),
    
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
    tenantIdx: index('occupancies_tenant_idx').on(table.tenantId),
    propertyIdx: index('occupancies_property_idx').on(table.propertyId),
    unitIdx: index('occupancies_unit_idx').on(table.unitId),
    customerIdx: index('occupancies_customer_idx').on(table.customerId),
    leaseIdx: index('occupancies_lease_idx').on(table.leaseId),
    statusIdx: index('occupancies_status_idx').on(table.status),
    onboardingStateIdx: index('occupancies_onboarding_state_idx').on(table.onboardingState),
  })
);

// ============================================================================
// Procedure Completion Log
// ============================================================================

export const procedureCompletionLogs = pgTable(
  'procedure_completion_logs',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    occupancyId: text('occupancy_id').notNull().references(() => occupancies.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => customers.id),
    
    procedureCode: text('procedure_code').notNull(),
    procedureName: text('procedure_name').notNull(),
    procedureCategory: text('procedure_category').notNull(),
    
    deliveredAt: timestamp('delivered_at', { withTimezone: true }).notNull(),
    deliveredVia: text('delivered_via').notNull(),
    
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    confirmationMethod: text('confirmation_method'),
    evidenceUrl: text('evidence_url'),
    
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
  },
  (table) => ({
    tenantIdx: index('procedure_completion_logs_tenant_idx').on(table.tenantId),
    occupancyIdx: index('procedure_completion_logs_occupancy_idx').on(table.occupancyId),
    customerIdx: index('procedure_completion_logs_customer_idx').on(table.customerId),
    procedureCodeIdx: index('procedure_completion_logs_procedure_code_idx').on(table.procedureCode),
  })
);

// ============================================================================
// Access Handover Records
// ============================================================================

export const accessHandoverRecords = pgTable(
  'access_handover_records',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    occupancyId: text('occupancy_id').notNull().references(() => occupancies.id, { onDelete: 'cascade' }),
    
    itemType: text('item_type').notNull(),
    itemDescription: text('item_description').notNull(),
    quantity: integer('quantity').notNull().default(1),
    serialNumber: text('serial_number'),
    
    handedOverAt: timestamp('handed_over_at', { withTimezone: true }),
    handedOverTo: text('handed_over_to'),
    handedOverBy: text('handed_over_by'),
    
    returnedAt: timestamp('returned_at', { withTimezone: true }),
    returnedTo: text('returned_to'),
    returnedBy: text('returned_by'),
    returnCondition: text('return_condition'),
    
    handoverPhotoUrl: text('handover_photo_url'),
    returnPhotoUrl: text('return_photo_url'),
    notes: text('notes'),
    
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('access_handover_records_tenant_idx').on(table.tenantId),
    occupancyIdx: index('access_handover_records_occupancy_idx').on(table.occupancyId),
    itemTypeIdx: index('access_handover_records_item_type_idx').on(table.itemType),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const occupanciesRelations = relations(occupancies, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [occupancies.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [occupancies.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [occupancies.unitId],
    references: [units.id],
  }),
  customer: one(customers, {
    fields: [occupancies.customerId],
    references: [customers.id],
  }),
  lease: one(leases, {
    fields: [occupancies.leaseId],
    references: [leases.id],
  }),
  procedureCompletionLogs: many(procedureCompletionLogs),
  accessHandoverRecords: many(accessHandoverRecords),
}));

export const procedureCompletionLogsRelations = relations(procedureCompletionLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [procedureCompletionLogs.tenantId],
    references: [tenants.id],
  }),
  occupancy: one(occupancies, {
    fields: [procedureCompletionLogs.occupancyId],
    references: [occupancies.id],
  }),
  customer: one(customers, {
    fields: [procedureCompletionLogs.customerId],
    references: [customers.id],
  }),
}));

export const accessHandoverRecordsRelations = relations(accessHandoverRecords, ({ one }) => ({
  tenant: one(tenants, {
    fields: [accessHandoverRecords.tenantId],
    references: [tenants.id],
  }),
  occupancy: one(occupancies, {
    fields: [accessHandoverRecords.occupancyId],
    references: [occupancies.id],
  }),
}));
