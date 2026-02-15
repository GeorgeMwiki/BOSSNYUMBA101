/**
 * Customer Schema
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

// ============================================================================
// Enums
// ============================================================================

export const customerStatusEnum = pgEnum('customer_status', [
  'prospect',
  'applicant',
  'approved',
  'active',
  'former',
  'blacklisted',
]);

export const idDocumentTypeEnum = pgEnum('id_document_type', [
  'national_id',
  'passport',
  'driving_license',
  'military_id',
  'voter_id',
  'work_permit',
  'other',
]);

export const kycStatusEnum = pgEnum('kyc_status', [
  'pending',
  'in_review',
  'verified',
  'rejected',
  'expired',
]);

// ============================================================================
// Customers Table
// ============================================================================

export const customers = pgTable(
  'customers',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    
    // Identity
    customerCode: text('customer_code').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    alternatePhone: text('alternate_phone'),
    
    // Profile
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    middleName: text('middle_name'),
    dateOfBirth: timestamp('date_of_birth', { withTimezone: true }),
    nationality: text('nationality'),
    occupation: text('occupation'),
    employer: text('employer'),
    employerAddress: text('employer_address'),
    monthlyIncome: integer('monthly_income'), // In minor units
    incomeCurrency: text('income_currency').default('KES'),
    
    // Status
    status: customerStatusEnum('status').notNull().default('prospect'),
    
    // KYC
    kycStatus: kycStatusEnum('kyc_status').notNull().default('pending'),
    kycVerifiedAt: timestamp('kyc_verified_at', { withTimezone: true }),
    kycVerifiedBy: text('kyc_verified_by'),
    kycExpiresAt: timestamp('kyc_expires_at', { withTimezone: true }),
    kycNotes: text('kyc_notes'),
    
    // ID Document
    idDocumentType: idDocumentTypeEnum('id_document_type'),
    idDocumentNumber: text('id_document_number'),
    idDocumentExpiresAt: timestamp('id_document_expires_at', { withTimezone: true }),
    idDocumentFrontUrl: text('id_document_front_url'),
    idDocumentBackUrl: text('id_document_back_url'),
    
    // Current Address (before moving)
    currentAddressLine1: text('current_address_line1'),
    currentAddressLine2: text('current_address_line2'),
    currentCity: text('current_city'),
    currentState: text('current_state'),
    currentPostalCode: text('current_postal_code'),
    currentCountry: text('current_country'),
    
    // Emergency Contact
    emergencyContactName: text('emergency_contact_name'),
    emergencyContactRelationship: text('emergency_contact_relationship'),
    emergencyContactPhone: text('emergency_contact_phone'),
    emergencyContactEmail: text('emergency_contact_email'),
    
    // References
    references: jsonb('references').default([]),
    
    // Blacklist info
    blacklistedAt: timestamp('blacklisted_at', { withTimezone: true }),
    blacklistedReason: text('blacklisted_reason'),
    blacklistedBy: text('blacklisted_by'),
    
    // Communication preferences
    preferredContactMethod: text('preferred_contact_method').default('email'),
    marketingOptIn: boolean('marketing_opt_in').default(false),
    smsNotifications: boolean('sms_notifications').default(true),
    emailNotifications: boolean('email_notifications').default(true),
    
    // Portal access
    portalAccessEnabled: boolean('portal_access_enabled').default(true),
    portalLastLogin: timestamp('portal_last_login', { withTimezone: true }),
    
    // Profile image
    avatarUrl: text('avatar_url'),
    
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
    tenantIdx: index('customers_tenant_idx').on(table.tenantId),
    codeTenantIdx: uniqueIndex('customers_code_tenant_idx').on(table.tenantId, table.customerCode),
    emailTenantIdx: uniqueIndex('customers_email_tenant_idx').on(table.tenantId, table.email),
    phoneTenantIdx: index('customers_phone_tenant_idx').on(table.tenantId, table.phone),
    statusIdx: index('customers_status_idx').on(table.status),
    kycStatusIdx: index('customers_kyc_status_idx').on(table.kycStatus),
    nameIdx: index('customers_name_idx').on(table.firstName, table.lastName),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const customersRelations = relations(customers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
}));
