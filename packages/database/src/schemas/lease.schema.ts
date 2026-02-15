/**
 * Lease Schema
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

// ============================================================================
// Enums
// ============================================================================

export const leaseStatusEnum = pgEnum('lease_status', [
  'draft',
  'pending_approval',
  'approved',
  'active',
  'expiring_soon',
  'expired',
  'terminated',
  'renewed',
  'cancelled',
]);

export const leaseTypeEnum = pgEnum('lease_type', [
  'fixed_term',
  'month_to_month',
  'short_term',
  'corporate',
  'student',
  'subsidized',
]);

export const rentFrequencyEnum = pgEnum('rent_frequency', [
  'weekly',
  'bi_weekly',
  'monthly',
  'quarterly',
  'semi_annually',
  'annually',
]);

export const terminationReasonEnum = pgEnum('termination_reason', [
  'end_of_term',
  'mutual_agreement',
  'tenant_request',
  'landlord_request',
  'non_payment',
  'lease_violation',
  'property_sale',
  'property_damage',
  'eviction',
  'other',
]);

// ============================================================================
// Leases Table
// ============================================================================

export const leases = pgTable(
  'leases',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').notNull().references(() => properties.id),
    unitId: text('unit_id').notNull().references(() => units.id),
    customerId: text('customer_id').notNull().references(() => customers.id),
    
    // Identity
    leaseNumber: text('lease_number').notNull(),
    
    // Type & Status
    leaseType: leaseTypeEnum('lease_type').notNull().default('fixed_term'),
    status: leaseStatusEnum('status').notNull().default('draft'),
    
    // Term
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),
    moveInDate: timestamp('move_in_date', { withTimezone: true }),
    moveOutDate: timestamp('move_out_date', { withTimezone: true }),
    
    // Rent
    rentAmount: integer('rent_amount').notNull(), // In minor units
    rentCurrency: text('rent_currency').notNull().default('KES'),
    rentFrequency: rentFrequencyEnum('rent_frequency').notNull().default('monthly'),
    rentDueDay: integer('rent_due_day').notNull().default(1),
    gracePeriodDays: integer('grace_period_days').notNull().default(5),
    
    // Late fees
    lateFeeType: text('late_fee_type').default('fixed'), // 'fixed' or 'percentage'
    lateFeeAmount: integer('late_fee_amount').default(0),
    lateFeePercentage: decimal('late_fee_percentage', { precision: 5, scale: 2 }).default('0'),
    maxLateFee: integer('max_late_fee'),
    
    // Deposit
    securityDepositAmount: integer('security_deposit_amount').notNull().default(0),
    securityDepositPaid: integer('security_deposit_paid').notNull().default(0),
    securityDepositRefunded: integer('security_deposit_refunded').default(0),
    depositRefundDate: timestamp('deposit_refund_date', { withTimezone: true }),
    depositRefundNotes: text('deposit_refund_notes'),
    
    // Occupants
    primaryOccupant: jsonb('primary_occupant').notNull(), // { name, relationship, idNumber }
    additionalOccupants: jsonb('additional_occupants').default([]),
    maxOccupants: integer('max_occupants').default(4),
    
    // Pets
    petsAllowed: boolean('pets_allowed').notNull().default(false),
    petDeposit: integer('pet_deposit').default(0),
    petRent: integer('pet_rent').default(0),
    petDetails: jsonb('pet_details').default([]),
    
    // Utilities
    utilitiesIncludedInRent: jsonb('utilities_included_in_rent').default([]),
    utilityResponsibility: text('utility_responsibility').default('tenant'),
    
    // Auto-renewal
    autoRenew: boolean('auto_renew').notNull().default(false),
    renewalTermMonths: integer('renewal_term_months').default(12),
    renewalRentIncrease: decimal('renewal_rent_increase', { precision: 5, scale: 2 }).default('0'),
    renewalNoticeRequired: integer('renewal_notice_required').default(30), // Days
    
    // Termination
    terminatedAt: timestamp('terminated_at', { withTimezone: true }),
    terminationReason: terminationReasonEnum('termination_reason'),
    terminationNotes: text('termination_notes'),
    terminatedBy: text('terminated_by'),
    noticeGivenDate: timestamp('notice_given_date', { withTimezone: true }),
    noticePeriodDays: integer('notice_period_days').default(30),
    
    // Move-out
    moveOutInspectionDate: timestamp('move_out_inspection_date', { withTimezone: true }),
    moveOutInspectionNotes: text('move_out_inspection_notes'),
    deductionsFromDeposit: integer('deductions_from_deposit').default(0),
    deductionDetails: jsonb('deduction_details').default([]),
    
    // Documents
    leaseDocumentUrl: text('lease_document_url'),
    signedByTenant: boolean('signed_by_tenant').default(false),
    tenantSignedAt: timestamp('tenant_signed_at', { withTimezone: true }),
    signedByLandlord: boolean('signed_by_landlord').default(false),
    landlordSignedAt: timestamp('landlord_signed_at', { withTimezone: true }),
    signatureMethod: text('signature_method'), // 'electronic' or 'physical'
    
    // Previous lease (for renewals)
    previousLeaseId: text('previous_lease_id'),
    
    // Special terms
    specialTerms: text('special_terms'),
    customClauses: jsonb('custom_clauses').default([]),
    
    // Balance tracking
    currentBalance: integer('current_balance').default(0), // Positive = amount owed
    lastPaymentDate: timestamp('last_payment_date', { withTimezone: true }),
    lastPaymentAmount: integer('last_payment_amount'),
    
    // Approval
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by'),
    
    // Activation
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    activatedBy: text('activated_by'),
    
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
    tenantIdx: index('leases_tenant_idx').on(table.tenantId),
    numberTenantIdx: uniqueIndex('leases_number_tenant_idx').on(table.tenantId, table.leaseNumber),
    propertyIdx: index('leases_property_idx').on(table.propertyId),
    unitIdx: index('leases_unit_idx').on(table.unitId),
    customerIdx: index('leases_customer_idx').on(table.customerId),
    statusIdx: index('leases_status_idx').on(table.status),
    startDateIdx: index('leases_start_date_idx').on(table.startDate),
    endDateIdx: index('leases_end_date_idx').on(table.endDate),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const leasesRelations = relations(leases, ({ one }) => ({
  tenant: one(tenants, {
    fields: [leases.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [leases.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [leases.unitId],
    references: [units.id],
  }),
  customer: one(customers, {
    fields: [leases.customerId],
    references: [customers.id],
  }),
  previousLease: one(leases, {
    fields: [leases.previousLeaseId],
    references: [leases.id],
    relationName: 'leaseRenewal',
  }),
}));
