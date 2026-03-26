/**
 * Financial Profiles Schema
 * Customer financial capability, litigation history, and credit assessment
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
import { tenants, users } from './tenant.schema.js';
import { customers } from './customer.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const creditRiskRatingEnum = pgEnum('credit_risk_rating', [
  'low',
  'medium',
  'high',
  'very_high',
  'not_assessed',
]);

export const paymentTendencyEnum = pgEnum('payment_tendency', [
  'excellent',
  'good',
  'fair',
  'poor',
  'not_assessed',
]);

// ============================================================================
// Financial Profiles Table
// ============================================================================

export const financialProfiles = pgTable(
  'financial_profiles',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),

    // Business/Employment info
    employmentStatus: text('employment_status'), // 'employed', 'self_employed', 'business_owner', 'retired', 'other'
    businessName: text('business_name'),
    businessRegistrationNumber: text('business_registration_number'),
    tinNumber: text('tin_number'), // Tanzania TIN

    // Financial standing
    annualRevenue: integer('annual_revenue'), // Minor units
    currency: text('currency').notNull().default('TZS'),
    financialStatementUrls: jsonb('financial_statement_urls').default([]), // [{url, year, type}]
    bankStatementUrls: jsonb('bank_statement_urls').default([]),
    bankName: text('bank_name'),
    bankAccountRef: text('bank_account_ref'),

    // Litigation history
    hasActiveLitigation: boolean('has_active_litigation').notNull().default(false),
    litigationDetails: jsonb('litigation_details').default([]), // [{caseNumber, court, status, description, amount}]
    previousDefaultHistory: boolean('previous_default_history').notNull().default(false),
    defaultDetails: jsonb('default_details').default([]),

    // Credit assessment
    creditRiskRating: creditRiskRatingEnum('credit_risk_rating').notNull().default('not_assessed'),
    paymentTendency: paymentTendencyEnum('payment_tendency').notNull().default('not_assessed'),
    creditAssessmentNotes: text('credit_assessment_notes'),
    creditAssessedAt: timestamp('credit_assessed_at', { withTimezone: true }),
    creditAssessedBy: text('credit_assessed_by').references(() => users.id),

    // Guarantor information
    guarantorName: text('guarantor_name'),
    guarantorIdNumber: text('guarantor_id_number'),
    guarantorPhone: text('guarantor_phone'),
    guarantorAddress: text('guarantor_address'),
    guarantorRelationship: text('guarantor_relationship'),

    // Risk notes
    riskAssessmentNotes: text('risk_assessment_notes'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('financial_profiles_tenant_idx').on(table.tenantId),
    customerTenantIdx: uniqueIndex('financial_profiles_customer_tenant_idx').on(table.tenantId, table.customerId),
    creditRiskIdx: index('financial_profiles_credit_risk_idx').on(table.creditRiskRating),
    litigationIdx: index('financial_profiles_litigation_idx').on(table.hasActiveLitigation),
    paymentTendencyIdx: index('financial_profiles_payment_tendency_idx').on(table.paymentTendency),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const financialProfilesRelations = relations(financialProfiles, ({ one }) => ({
  tenant: one(tenants, {
    fields: [financialProfiles.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [financialProfiles.customerId],
    references: [customers.id],
  }),
  assessedBy: one(users, {
    fields: [financialProfiles.creditAssessedBy],
    references: [users.id],
  }),
}));
