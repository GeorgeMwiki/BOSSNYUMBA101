/**
 * Ledger and Financial Account Schemas
 * Double-entry bookkeeping tables for the payments ledger service
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { customers } from './customer.schema.js';
import { properties, units } from './property.schema.js';
import { leases } from './lease.schema.js';
import { payments } from './payment.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const accountTypeEnum = pgEnum('account_type', [
  'CUSTOMER_LIABILITY',
  'CUSTOMER_DEPOSIT',
  'OWNER_OPERATING',
  'OWNER_RESERVE',
  'PLATFORM_REVENUE',
  'PLATFORM_HOLDING',
  'TRUST_ACCOUNT',
  'EXPENSE',
  'ASSET',
]);

export const accountStatusEnum = pgEnum('account_status', [
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
]);

export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', [
  'RENT_CHARGE',
  'RENT_PAYMENT',
  'DEPOSIT_CHARGE',
  'DEPOSIT_PAYMENT',
  'DEPOSIT_REFUND',
  'LATE_FEE',
  'MAINTENANCE_CHARGE',
  'UTILITY_CHARGE',
  'OWNER_CONTRIBUTION',
  'OWNER_DISBURSEMENT',
  'PLATFORM_FEE',
  'PAYMENT_PROCESSING_FEE',
  'REFUND',
  'ADJUSTMENT',
  'WRITE_OFF',
  'TRANSFER_IN',
  'TRANSFER_OUT',
]);

export const entryDirectionEnum = pgEnum('entry_direction', [
  'DEBIT',
  'CREDIT',
]);

export const statementTypeEnum = pgEnum('statement_type', [
  'OWNER_STATEMENT',
  'CUSTOMER_STATEMENT',
  'PROPERTY_STATEMENT',
  'RECONCILIATION_REPORT',
]);

export const statementStatusEnum = pgEnum('statement_status', [
  'DRAFT',
  'GENERATED',
  'SENT',
  'VIEWED',
  'ARCHIVED',
]);

export const statementPeriodTypeEnum = pgEnum('statement_period_type', [
  'MONTHLY',
  'QUARTERLY',
  'ANNUAL',
  'CUSTOM',
]);

export const disbursementStatusEnum = pgEnum('disbursement_status', [
  'PENDING',
  'PROCESSING',
  'IN_TRANSIT',
  'PAID',
  'FAILED',
  'CANCELLED',
]);

// ============================================================================
// Accounts Table
// ============================================================================

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    
    // Account ownership
    customerId: text('customer_id').references(() => customers.id),
    ownerId: text('owner_id'), // References owner table if exists
    propertyId: text('property_id').references(() => properties.id),
    
    // Account info
    name: text('name').notNull(),
    type: accountTypeEnum('type').notNull(),
    status: accountStatusEnum('status').notNull().default('ACTIVE'),
    currency: text('currency').notNull().default('KES'),
    
    // Balance tracking
    balanceMinorUnits: integer('balance_minor_units').notNull().default(0),
    lastEntryId: text('last_entry_id'),
    lastEntryAt: timestamp('last_entry_at', { withTimezone: true }),
    entryCount: integer('entry_count').notNull().default(0),
    
    // Metadata
    description: text('description'),
    metadata: jsonb('metadata').default({}),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedBy: text('closed_by'),
  },
  (table) => ({
    tenantIdx: index('accounts_tenant_idx').on(table.tenantId),
    customerIdx: index('accounts_customer_idx').on(table.customerId),
    ownerIdx: index('accounts_owner_idx').on(table.ownerId),
    propertyIdx: index('accounts_property_idx').on(table.propertyId),
    typeIdx: index('accounts_type_idx').on(table.type),
    statusIdx: index('accounts_status_idx').on(table.status),
    customerTypeIdx: uniqueIndex('accounts_customer_type_idx').on(table.tenantId, table.customerId, table.type),
    ownerTypeIdx: uniqueIndex('accounts_owner_type_idx').on(table.tenantId, table.ownerId, table.type),
  })
);

// ============================================================================
// Ledger Entries Table (Immutable)
// ============================================================================

export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull().references(() => accounts.id),
    
    // Journal grouping (for double-entry)
    journalId: text('journal_id').notNull(),
    
    // Entry type
    type: ledgerEntryTypeEnum('type').notNull(),
    direction: entryDirectionEnum('direction').notNull(),
    
    // Amount
    amountMinorUnits: integer('amount_minor_units').notNull(),
    currency: text('currency').notNull().default('KES'),
    
    // Balance after this entry (running balance)
    balanceAfterMinorUnits: integer('balance_after_minor_units').notNull(),
    
    // Sequence for ordering within account
    sequenceNumber: integer('sequence_number').notNull(),
    
    // Dates
    effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
    postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
    
    // Related entities
    paymentIntentId: text('payment_intent_id'),
    leaseId: text('lease_id').references(() => leases.id),
    propertyId: text('property_id').references(() => properties.id),
    unitId: text('unit_id').references(() => units.id),
    invoiceId: text('invoice_id'),
    
    // Description
    description: text('description'),
    
    // Metadata
    metadata: jsonb('metadata').default({}),
    
    // Audit (entries are immutable)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
  },
  (table) => ({
    tenantIdx: index('ledger_entries_tenant_idx').on(table.tenantId),
    accountIdx: index('ledger_entries_account_idx').on(table.accountId),
    journalIdx: index('ledger_entries_journal_idx').on(table.journalId),
    typeIdx: index('ledger_entries_type_idx').on(table.type),
    effectiveDateIdx: index('ledger_entries_effective_date_idx').on(table.effectiveDate),
    paymentIntentIdx: index('ledger_entries_payment_intent_idx').on(table.paymentIntentId),
    leaseIdx: index('ledger_entries_lease_idx').on(table.leaseId),
    accountSequenceIdx: uniqueIndex('ledger_entries_account_sequence_idx').on(table.accountId, table.sequenceNumber),
    postedAtIdx: index('ledger_entries_posted_at_idx').on(table.postedAt),
  })
);

// ============================================================================
// Statements Table
// ============================================================================

export const statements = pgTable(
  'statements',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull().references(() => accounts.id),
    
    // Ownership
    ownerId: text('owner_id'),
    customerId: text('customer_id').references(() => customers.id),
    propertyId: text('property_id').references(() => properties.id),
    
    // Statement info
    type: statementTypeEnum('type').notNull(),
    status: statementStatusEnum('status').notNull().default('DRAFT'),
    periodType: statementPeriodTypeEnum('period_type').notNull(),
    
    // Period
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    
    // Currency
    currency: text('currency').notNull().default('KES'),
    
    // Balances
    openingBalanceMinorUnits: integer('opening_balance_minor_units').notNull(),
    closingBalanceMinorUnits: integer('closing_balance_minor_units').notNull(),
    totalDebitsMinorUnits: integer('total_debits_minor_units').notNull(),
    totalCreditsMinorUnits: integer('total_credits_minor_units').notNull(),
    netChangeMinorUnits: integer('net_change_minor_units').notNull(),
    
    // Content
    lineItems: jsonb('line_items').notNull().default([]),
    summaries: jsonb('summaries').notNull().default([]),
    
    // Delivery
    recipientEmail: text('recipient_email'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    
    // Document
    documentUrl: text('document_url'),
    
    // Timestamps
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('statements_tenant_idx').on(table.tenantId),
    accountIdx: index('statements_account_idx').on(table.accountId),
    ownerIdx: index('statements_owner_idx').on(table.ownerId),
    customerIdx: index('statements_customer_idx').on(table.customerId),
    typeIdx: index('statements_type_idx').on(table.type),
    statusIdx: index('statements_status_idx').on(table.status),
    periodIdx: index('statements_period_idx').on(table.periodStart, table.periodEnd),
    accountPeriodIdx: uniqueIndex('statements_account_period_idx').on(
      table.tenantId, table.accountId, table.type, table.periodStart, table.periodEnd
    ),
  })
);

// ============================================================================
// Disbursements Table
// ============================================================================

export const disbursements = pgTable(
  'disbursements',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id').notNull(),
    
    // Amount
    amountMinorUnits: integer('amount_minor_units').notNull(),
    currency: text('currency').notNull().default('KES'),
    
    // Status
    status: disbursementStatusEnum('status').notNull().default('PENDING'),
    
    // Destination
    destination: text('destination').notNull(),
    destinationType: text('destination_type').notNull().default('bank_account'),
    
    // Provider
    provider: text('provider'),
    transferId: text('transfer_id'),
    providerResponse: jsonb('provider_response').default({}),
    
    // Description
    description: text('description'),
    
    // Dates
    initiatedAt: timestamp('initiated_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    estimatedArrival: timestamp('estimated_arrival', { withTimezone: true }),
    
    // Failure
    failureReason: text('failure_reason'),
    failureCode: text('failure_code'),
    
    // Idempotency
    idempotencyKey: text('idempotency_key'),
    
    // Related ledger entry
    ledgerEntryId: text('ledger_entry_id').references(() => ledgerEntries.id),
    
    // Metadata
    metadata: jsonb('metadata').default({}),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('disbursements_tenant_idx').on(table.tenantId),
    ownerIdx: index('disbursements_owner_idx').on(table.ownerId),
    statusIdx: index('disbursements_status_idx').on(table.status),
    transferIdx: index('disbursements_transfer_idx').on(table.provider, table.transferId),
    idempotencyIdx: uniqueIndex('disbursements_idempotency_idx').on(table.tenantId, table.idempotencyKey),
    createdAtIdx: index('disbursements_created_at_idx').on(table.createdAt),
  })
);

// ============================================================================
// Payment Intents Table (for tracking payment orchestration)
// ============================================================================

export const paymentIntents = pgTable(
  'payment_intents',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => customers.id),
    leaseId: text('lease_id').references(() => leases.id),
    
    // Type
    type: text('type').notNull(),
    
    // Status
    status: text('status').notNull().default('PENDING'),
    
    // Amount
    amountMinorUnits: integer('amount_minor_units').notNull(),
    currency: text('currency').notNull().default('KES'),
    platformFeeMinorUnits: integer('platform_fee_minor_units'),
    netAmountMinorUnits: integer('net_amount_minor_units'),
    
    // Provider
    providerName: text('provider_name'),
    externalId: text('external_id'),
    
    // Description
    description: text('description'),
    statementDescriptor: text('statement_descriptor'),
    
    // Idempotency
    idempotencyKey: text('idempotency_key'),
    
    // Receipt
    receiptUrl: text('receipt_url'),
    
    // Refund tracking
    refundedAmountMinorUnits: integer('refunded_amount_minor_units').default(0),
    
    // Failure
    failureReason: text('failure_reason'),
    
    // Dates
    paidAt: timestamp('paid_at', { withTimezone: true }),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    
    // Metadata
    metadata: jsonb('metadata').default({}),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('payment_intents_tenant_idx').on(table.tenantId),
    customerIdx: index('payment_intents_customer_idx').on(table.customerId),
    leaseIdx: index('payment_intents_lease_idx').on(table.leaseId),
    statusIdx: index('payment_intents_status_idx').on(table.status),
    externalIdx: uniqueIndex('payment_intents_external_idx').on(table.providerName, table.externalId),
    idempotencyIdx: uniqueIndex('payment_intents_idempotency_idx').on(table.tenantId, table.idempotencyKey),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [accounts.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [accounts.customerId],
    references: [customers.id],
  }),
  property: one(properties, {
    fields: [accounts.propertyId],
    references: [properties.id],
  }),
  ledgerEntries: many(ledgerEntries),
  statements: many(statements),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  tenant: one(tenants, {
    fields: [ledgerEntries.tenantId],
    references: [tenants.id],
  }),
  account: one(accounts, {
    fields: [ledgerEntries.accountId],
    references: [accounts.id],
  }),
  lease: one(leases, {
    fields: [ledgerEntries.leaseId],
    references: [leases.id],
  }),
  property: one(properties, {
    fields: [ledgerEntries.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [ledgerEntries.unitId],
    references: [units.id],
  }),
}));

export const statementsRelations = relations(statements, ({ one }) => ({
  tenant: one(tenants, {
    fields: [statements.tenantId],
    references: [tenants.id],
  }),
  account: one(accounts, {
    fields: [statements.accountId],
    references: [accounts.id],
  }),
  customer: one(customers, {
    fields: [statements.customerId],
    references: [customers.id],
  }),
  property: one(properties, {
    fields: [statements.propertyId],
    references: [properties.id],
  }),
}));

export const disbursementsRelations = relations(disbursements, ({ one }) => ({
  tenant: one(tenants, {
    fields: [disbursements.tenantId],
    references: [tenants.id],
  }),
  ledgerEntry: one(ledgerEntries, {
    fields: [disbursements.ledgerEntryId],
    references: [ledgerEntries.id],
  }),
}));

export const paymentIntentsRelations = relations(paymentIntents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [paymentIntents.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [paymentIntents.customerId],
    references: [customers.id],
  }),
  lease: one(leases, {
    fields: [paymentIntents.leaseId],
    references: [leases.id],
  }),
}));
