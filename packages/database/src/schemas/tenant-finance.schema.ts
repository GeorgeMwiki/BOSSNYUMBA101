/**
 * Tenant Financial Profile Schema
 *
 * Two additive tables backing SCAFFOLDED-5 (tenant financial statement intake):
 *
 *   - tenant_financial_statements  — income, expenses, bank references,
 *                                    supporting documents
 *   - tenant_litigation_history    — known lawsuits / judgments / evictions
 *
 * Both are tenant-isolated via `tenant_id` FK (multi-tenant SaaS).
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  pgEnum,
  decimal,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { customers } from './customer.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const financialStatementStatusEnum = pgEnum(
  'financial_statement_status',
  [
    'draft',
    'submitted',
    'under_review',
    'verified',
    'rejected',
    'expired',
  ],
);

export const bankReferenceStatusEnum = pgEnum('bank_reference_status', [
  'not_requested',
  'pending',
  'verified',
  'failed',
  'manual_override',
]);

export const litigationKindEnum = pgEnum('litigation_kind', [
  'eviction',
  'judgment',
  'lawsuit_as_plaintiff',
  'lawsuit_as_defendant',
  'bankruptcy',
  'other',
]);

export const litigationOutcomeEnum = pgEnum('litigation_outcome', [
  'pending',
  'won',
  'lost',
  'settled',
  'dismissed',
  'withdrawn',
]);

// ============================================================================
// tenant_financial_statements
// ============================================================================

export const tenantFinancialStatements = pgTable(
  'tenant_financial_statements',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    status: financialStatementStatusEnum('status').notNull().default('draft'),

    // Income (minor units)
    monthlyGrossIncome: integer('monthly_gross_income').notNull().default(0),
    monthlyNetIncome: integer('monthly_net_income').notNull().default(0),
    otherIncome: integer('other_income').notNull().default(0),
    incomeCurrency: text('income_currency').notNull().default('KES'),
    incomeSources: jsonb('income_sources').notNull().default([]),

    // Obligations (minor units)
    monthlyExpenses: integer('monthly_expenses').notNull().default(0),
    monthlyDebtService: integer('monthly_debt_service').notNull().default(0),
    existingArrears: integer('existing_arrears').notNull().default(0),

    // Employment
    employmentStatus: text('employment_status'),
    employerName: text('employer_name'),
    employmentStartDate: timestamp('employment_start_date', {
      withTimezone: true,
    }),
    employmentVerifiedAt: timestamp('employment_verified_at', {
      withTimezone: true,
    }),

    // Bank reference
    bankReferenceStatus: bankReferenceStatusEnum('bank_reference_status')
      .notNull()
      .default('not_requested'),
    bankReferenceProvider: text('bank_reference_provider'),
    bankReferenceRequestedAt: timestamp('bank_reference_requested_at', {
      withTimezone: true,
    }),
    bankReferenceReceivedAt: timestamp('bank_reference_received_at', {
      withTimezone: true,
    }),
    bankReferenceScore: decimal('bank_reference_score', {
      precision: 5,
      scale: 2,
    }),
    bankReferenceDetails: jsonb('bank_reference_details'),

    // Supporting documents (doc IDs)
    supportingDocumentIds: jsonb('supporting_document_ids').notNull().default([]),

    consentGiven: boolean('consent_given').notNull().default(false),
    consentGivenAt: timestamp('consent_given_at', { withTimezone: true }),

    // Audit
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    submittedBy: text('submitted_by'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: text('verified_by'),
    rejectedReason: text('rejected_reason'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index('tenant_financial_statements_tenant_idx').on(
      table.tenantId,
    ),
    customerIdx: index('tenant_financial_statements_customer_idx').on(
      table.customerId,
    ),
    statusIdx: index('tenant_financial_statements_status_idx').on(
      table.status,
    ),
  }),
);

// ============================================================================
// tenant_litigation_history
// ============================================================================

export const tenantLitigationHistory = pgTable(
  'tenant_litigation_history',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    kind: litigationKindEnum('kind').notNull(),
    outcome: litigationOutcomeEnum('outcome').notNull().default('pending'),

    caseNumber: text('case_number'),
    court: text('court'),
    jurisdiction: text('jurisdiction'),
    filedAt: timestamp('filed_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    amountInvolved: integer('amount_involved'),
    currency: text('currency'),

    summary: text('summary'),
    evidenceDocumentIds: jsonb('evidence_document_ids').notNull().default([]),

    disclosedBySelf: boolean('disclosed_by_self').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: text('verified_by'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
  },
  (table) => ({
    tenantIdx: index('tenant_litigation_history_tenant_idx').on(table.tenantId),
    customerIdx: index('tenant_litigation_history_customer_idx').on(
      table.customerId,
    ),
    kindIdx: index('tenant_litigation_history_kind_idx').on(table.kind),
  }),
);

// ============================================================================
// Relations
// ============================================================================

export const tenantFinancialStatementsRelations = relations(
  tenantFinancialStatements,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [tenantFinancialStatements.tenantId],
      references: [tenants.id],
    }),
    customer: one(customers, {
      fields: [tenantFinancialStatements.customerId],
      references: [customers.id],
    }),
  }),
);

export const tenantLitigationHistoryRelations = relations(
  tenantLitigationHistory,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [tenantLitigationHistory.tenantId],
      references: [tenants.id],
    }),
    customer: one(customers, {
      fields: [tenantLitigationHistory.customerId],
      references: [customers.id],
    }),
  }),
);
