/**
 * Payment, Invoice, and Transaction Schemas
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
import { paymentPlanStatusEnum } from './payment-plan.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'pending',
  'sent',
  'viewed',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
  'void',
  'written_off',
]);

export const invoiceTypeEnum = pgEnum('invoice_type', [
  'rent',
  'deposit',
  'utilities',
  'maintenance',
  'late_fee',
  'other',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'mpesa',
  'bank_transfer',
  'card',
  'cash',
  'cheque',
  'other',
]);

export const transactionTypeEnum = pgEnum('transaction_type', [
  'charge',
  'payment',
  'credit',
  'adjustment',
  'refund',
  'write_off',
  'deposit_hold',
  'deposit_release',
]);

// ============================================================================
// Invoices Table
// ============================================================================

export const invoices = pgTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => customers.id),
    leaseId: text('lease_id').references(() => leases.id),
    propertyId: text('property_id').references(() => properties.id),
    unitId: text('unit_id').references(() => units.id),
    
    // Identity
    invoiceNumber: text('invoice_number').notNull(),
    
    // Type & Status
    invoiceType: invoiceTypeEnum('invoice_type').notNull().default('rent'),
    status: invoiceStatusEnum('status').notNull().default('draft'),
    
    // Dates
    issueDate: timestamp('issue_date', { withTimezone: true }).notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    
    // Amounts
    subtotalAmount: integer('subtotal_amount').notNull().default(0), // In minor units
    taxAmount: integer('tax_amount').notNull().default(0),
    discountAmount: integer('discount_amount').notNull().default(0),
    totalAmount: integer('total_amount').notNull(), // In minor units
    paidAmount: integer('paid_amount').notNull().default(0),
    balanceAmount: integer('balance_amount').notNull(), // totalAmount - paidAmount
    currency: text('currency').notNull().default('KES'),
    
    // Tax
    taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
    taxType: text('tax_type'), // e.g., 'VAT', 'withholding'
    
    // Line items
    lineItems: jsonb('line_items').notNull().default([]),
    // Structure: [{ description, quantity, unitPrice, amount, taxable }]
    
    // Description
    description: text('description'),
    notes: text('notes'),
    customerNotes: text('customer_notes'), // Visible to customer
    
    // Communication
    sentAt: timestamp('sent_at', { withTimezone: true }),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    remindersSent: integer('reminders_sent').default(0),
    lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
    
    // Payment tracking
    firstPaymentAt: timestamp('first_payment_at', { withTimezone: true }),
    paidInFullAt: timestamp('paid_in_full_at', { withTimezone: true }),
    
    // Cancellation/void
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledBy: text('cancelled_by'),
    cancellationReason: text('cancellation_reason'),
    
    // Document
    pdfUrl: text('pdf_url'),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('invoices_tenant_idx').on(table.tenantId),
    numberTenantIdx: uniqueIndex('invoices_number_tenant_idx').on(table.tenantId, table.invoiceNumber),
    customerIdx: index('invoices_customer_idx').on(table.customerId),
    leaseIdx: index('invoices_lease_idx').on(table.leaseId),
    statusIdx: index('invoices_status_idx').on(table.status),
    dueDateIdx: index('invoices_due_date_idx').on(table.dueDate),
    typeIdx: index('invoices_type_idx').on(table.invoiceType),
  })
);

// ============================================================================
// Payments Table
// ============================================================================

export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => customers.id),
    invoiceId: text('invoice_id').references(() => invoices.id),
    leaseId: text('lease_id').references(() => leases.id),
    
    // Identity
    paymentNumber: text('payment_number').notNull(),
    externalReference: text('external_reference'), // Provider's reference
    
    // Status & Method
    status: paymentStatusEnum('status').notNull().default('pending'),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    
    // Amount
    amount: integer('amount').notNull(), // In minor units
    currency: text('currency').notNull().default('KES'),
    feeAmount: integer('fee_amount').default(0), // Transaction fees
    netAmount: integer('net_amount'), // amount - feeAmount
    
    // Refund tracking
    refundedAmount: integer('refunded_amount').default(0),
    
    // Payment details
    payerName: text('payer_name'),
    payerPhone: text('payer_phone'),
    payerEmail: text('payer_email'),
    payerAccount: text('payer_account'), // Bank account or phone number
    
    // Provider info
    provider: text('provider'), // 'mpesa', 'stripe', 'flutterwave', etc.
    providerTransactionId: text('provider_transaction_id'),
    providerResponse: jsonb('provider_response').default({}),
    
    // For manual payments
    receivedBy: text('received_by'),
    receiptNumber: text('receipt_number'),
    
    // Dates
    initiatedAt: timestamp('initiated_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    
    // Reconciliation
    reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
    reconciledBy: text('reconciled_by'),
    reconciledAmount: integer('reconciled_amount'),
    
    // Notes
    description: text('description'),
    internalNotes: text('internal_notes'),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('payments_tenant_idx').on(table.tenantId),
    numberTenantIdx: uniqueIndex('payments_number_tenant_idx').on(table.tenantId, table.paymentNumber),
    customerIdx: index('payments_customer_idx').on(table.customerId),
    invoiceIdx: index('payments_invoice_idx').on(table.invoiceId),
    leaseIdx: index('payments_lease_idx').on(table.leaseId),
    statusIdx: index('payments_status_idx').on(table.status),
    methodIdx: index('payments_method_idx').on(table.paymentMethod),
    providerTxIdx: uniqueIndex('payments_provider_tx_idx').on(table.provider, table.providerTransactionId),
    completedAtIdx: index('payments_completed_at_idx').on(table.completedAt),
  })
);

// ============================================================================
// Transactions Table (Ledger)
// ============================================================================

export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => customers.id),
    leaseId: text('lease_id').references(() => leases.id),
    propertyId: text('property_id').references(() => properties.id),
    unitId: text('unit_id').references(() => units.id),
    
    // Related records
    invoiceId: text('invoice_id').references(() => invoices.id),
    paymentId: text('payment_id').references(() => payments.id),
    
    // Identity
    transactionNumber: text('transaction_number').notNull(),
    journalId: text('journal_id'), // For grouping related entries
    
    // Type
    transactionType: transactionTypeEnum('transaction_type').notNull(),
    
    // Amount (positive = charge, negative = credit/payment)
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('KES'),
    
    // Balance
    balanceBefore: integer('balance_before').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    
    // Dates
    effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
    postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
    
    // Description
    description: text('description').notNull(),
    reference: text('reference'),
    
    // Sequence for ordering
    sequenceNumber: integer('sequence_number').notNull(),
    
    // Metadata
    metadata: jsonb('metadata').default({}),
    
    // Timestamps (immutable after creation)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
  },
  (table) => ({
    tenantIdx: index('transactions_tenant_idx').on(table.tenantId),
    numberTenantIdx: uniqueIndex('transactions_number_tenant_idx').on(table.tenantId, table.transactionNumber),
    customerIdx: index('transactions_customer_idx').on(table.customerId),
    leaseIdx: index('transactions_lease_idx').on(table.leaseId),
    invoiceIdx: index('transactions_invoice_idx').on(table.invoiceId),
    paymentIdx: index('transactions_payment_idx').on(table.paymentId),
    journalIdx: index('transactions_journal_idx').on(table.journalId),
    typeIdx: index('transactions_type_idx').on(table.transactionType),
    effectiveDateIdx: index('transactions_effective_date_idx').on(table.effectiveDate),
    sequenceIdx: index('transactions_sequence_idx').on(table.customerId, table.sequenceNumber),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [invoices.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  lease: one(leases, {
    fields: [invoices.leaseId],
    references: [leases.id],
  }),
  property: one(properties, {
    fields: [invoices.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [invoices.unitId],
    references: [units.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [payments.customerId],
    references: [customers.id],
  }),
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  lease: one(leases, {
    fields: [payments.leaseId],
    references: [leases.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [transactions.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [transactions.customerId],
    references: [customers.id],
  }),
  lease: one(leases, {
    fields: [transactions.leaseId],
    references: [leases.id],
  }),
  property: one(properties, {
    fields: [transactions.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [transactions.unitId],
    references: [units.id],
  }),
  invoice: one(invoices, {
    fields: [transactions.invoiceId],
    references: [invoices.id],
  }),
  payment: one(payments, {
    fields: [transactions.paymentId],
    references: [payments.id],
  }),
}));

// ============================================================================
// Additional Enums
// ============================================================================

export const receiptStatusEnum = pgEnum('receipt_status', [
  'draft',
  'issued',
  'voided',
  'superseded',
]);

// paymentPlanStatusEnum imported from payment-plan.schema.ts

export const arrearsStatusEnum = pgEnum('arrears_status', [
  'active',
  'payment_plan',
  'legal_action',
  'settled',
  'written_off',
  'disputed',
]);

export const ownerStatementStatusEnum = pgEnum('owner_statement_status', [
  'draft',
  'pending_review',
  'approved',
  'sent',
  'acknowledged',
]);


// ============================================================================
// Receipts Table
// ============================================================================

export const receipts = pgTable(
  'receipts',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => customers.id),
    paymentId: text('payment_id').notNull().references(() => payments.id),
    invoiceId: text('invoice_id').references(() => invoices.id),
    
    // Identity
    receiptNumber: text('receipt_number').notNull(),
    
    // Status
    status: receiptStatusEnum('status').notNull().default('issued'),
    
    // Amount
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('KES'),
    
    // Details
    description: text('description'),
    paymentMethod: text('payment_method').notNull(),
    
    // Dates
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    issuedBy: text('issued_by'),
    
    // Void
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedBy: text('voided_by'),
    voidReason: text('void_reason'),
    
    // Document
    pdfUrl: text('pdf_url'),
    
    // Delivery
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    deliveryChannel: text('delivery_channel'),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
  },
  (table) => ({
    tenantIdx: index('receipts_tenant_idx').on(table.tenantId),
    receiptNumberTenantIdx: uniqueIndex('receipts_receipt_number_tenant_idx').on(table.tenantId, table.receiptNumber),
    customerIdx: index('receipts_customer_idx').on(table.customerId),
    paymentIdx: index('receipts_payment_idx').on(table.paymentId),
    invoiceIdx: index('receipts_invoice_idx').on(table.invoiceId),
    statusIdx: index('receipts_status_idx').on(table.status),
    issuedAtIdx: index('receipts_issued_at_idx').on(table.issuedAt),
  })
);

// ============================================================================
// Payment Plans Table
// ============================================================================

export const paymentPlans = pgTable(
  'payment_plans',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => customers.id),
    leaseId: text('lease_id').references(() => leases.id),
    
    // Identity
    planNumber: text('plan_number').notNull(),
    
    // Status
    status: paymentPlanStatusEnum('status').notNull().default('proposed'),
    
    // Amounts
    totalAmount: integer('total_amount').notNull(),
    paidAmount: integer('paid_amount').notNull().default(0),
    remainingAmount: integer('remaining_amount').notNull(),
    currency: text('currency').notNull().default('KES'),
    
    // Terms
    numberOfInstallments: integer('number_of_installments').notNull(),
    installmentAmount: integer('installment_amount').notNull(),
    frequency: text('frequency').notNull().default('monthly'),
    
    // Schedule
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),
    installmentSchedule: jsonb('installment_schedule').notNull().default([]),
    
    // Related invoices
    relatedInvoices: jsonb('related_invoices').default([]),
    
    // Interest/fees
    interestRate: decimal('interest_rate', { precision: 5, scale: 2 }).default('0'),
    adminFee: integer('admin_fee').default(0),
    
    // Approval
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by'),
    approvalNotes: text('approval_notes'),
    
    // Default tracking
    missedPayments: integer('missed_payments').default(0),
    maxMissedPayments: integer('max_missed_payments').default(2),
    defaultedAt: timestamp('defaulted_at', { withTimezone: true }),
    
    // Agreement
    agreementUrl: text('agreement_url'),
    customerSignedAt: timestamp('customer_signed_at', { withTimezone: true }),
    
    // Completion
    completedAt: timestamp('completed_at', { withTimezone: true }),
    
    // Notes
    notes: text('notes'),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('payment_plans_tenant_idx').on(table.tenantId),
    planNumberTenantIdx: uniqueIndex('payment_plans_plan_number_tenant_idx').on(table.tenantId, table.planNumber),
    customerIdx: index('payment_plans_customer_idx').on(table.customerId),
    leaseIdx: index('payment_plans_lease_idx').on(table.leaseId),
    statusIdx: index('payment_plans_status_idx').on(table.status),
    startDateIdx: index('payment_plans_start_date_idx').on(table.startDate),
  })
);

// ============================================================================
// Arrears Cases Table
// ============================================================================

export const arrearsCases = pgTable(
  'arrears_cases',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => customers.id),
    leaseId: text('lease_id').references(() => leases.id),
    propertyId: text('property_id').references(() => properties.id),
    unitId: text('unit_id').references(() => units.id),
    
    // Identity
    caseNumber: text('case_number').notNull(),
    
    // Status
    status: arrearsStatusEnum('status').notNull().default('active'),
    
    // Amounts
    totalArrearsAmount: integer('total_arrears_amount').notNull(),
    currentBalance: integer('current_balance').notNull(),
    currency: text('currency').notNull().default('KES'),
    
    // Aging
    daysPastDue: integer('days_past_due').notNull(),
    agingBucket: text('aging_bucket').notNull(),
    
    // Related invoices
    overdueInvoices: jsonb('overdue_invoices').default([]),
    
    // Payment plan
    paymentPlanId: text('payment_plan_id'),
    
    // Collection ladder
    currentLadderStep: integer('current_ladder_step').default(0),
    ladderHistory: jsonb('ladder_history').default([]),
    lastContactAt: timestamp('last_contact_at', { withTimezone: true }),
    nextActionAt: timestamp('next_action_at', { withTimezone: true }),
    
    // Legal
    legalCaseId: text('legal_case_id'),
    legalActionInitiatedAt: timestamp('legal_action_initiated_at', { withTimezone: true }),
    
    // Promise to pay
    promiseToPayDate: timestamp('promise_to_pay_date', { withTimezone: true }),
    promiseToPayAmount: integer('promise_to_pay_amount'),
    promiseBroken: boolean('promise_broken').default(false),
    
    // Assignment
    assignedTo: text('assigned_to'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    
    // Resolution
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: text('resolved_by'),
    resolutionType: text('resolution_type'),
    resolutionNotes: text('resolution_notes'),
    
    // Write-off
    writtenOffAt: timestamp('written_off_at', { withTimezone: true }),
    writtenOffBy: text('written_off_by'),
    writtenOffAmount: integer('written_off_amount'),
    writeOffReason: text('write_off_reason'),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('arrears_cases_tenant_idx').on(table.tenantId),
    caseNumberTenantIdx: uniqueIndex('arrears_cases_case_number_tenant_idx').on(table.tenantId, table.caseNumber),
    customerIdx: index('arrears_cases_customer_idx').on(table.customerId),
    leaseIdx: index('arrears_cases_lease_idx').on(table.leaseId),
    statusIdx: index('arrears_cases_status_idx').on(table.status),
    agingBucketIdx: index('arrears_cases_aging_bucket_idx').on(table.agingBucket),
    nextActionAtIdx: index('arrears_cases_next_action_at_idx').on(table.nextActionAt),
  })
);

// ============================================================================
// Owner Statements Table
// ============================================================================

export const ownerStatements = pgTable(
  'owner_statements',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').notNull().references(() => properties.id),
    ownerId: text('owner_id').notNull(),
    
    // Identity
    statementNumber: text('statement_number').notNull(),
    
    // Period
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    
    // Status
    status: ownerStatementStatusEnum('status').notNull().default('draft'),
    
    // Summary
    grossRentCollected: integer('gross_rent_collected').notNull().default(0),
    otherIncome: integer('other_income').notNull().default(0),
    totalIncome: integer('total_income').notNull().default(0),
    
    managementFee: integer('management_fee').notNull().default(0),
    maintenanceExpenses: integer('maintenance_expenses').notNull().default(0),
    otherExpenses: integer('other_expenses').notNull().default(0),
    totalExpenses: integer('total_expenses').notNull().default(0),
    
    netIncome: integer('net_income').notNull().default(0),
    
    // Disbursement
    amountDue: integer('amount_due').notNull().default(0),
    amountDisbursed: integer('amount_disbursed').notNull().default(0),
    disbursedAt: timestamp('disbursed_at', { withTimezone: true }),
    disbursementRef: text('disbursement_ref'),
    
    currency: text('currency').notNull().default('KES'),
    
    // Line items
    incomeLineItems: jsonb('income_line_items').default([]),
    expenseLineItems: jsonb('expense_line_items').default([]),
    
    // Occupancy summary
    occupancySummary: jsonb('occupancy_summary').default({}),
    
    // Document
    pdfUrl: text('pdf_url'),
    
    // Approval
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by'),
    
    // Sending
    sentAt: timestamp('sent_at', { withTimezone: true }),
    sentBy: text('sent_by'),
    deliveryChannel: text('delivery_channel'),
    
    // Acknowledgment
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    
    // Notes
    internalNotes: text('internal_notes'),
    ownerNotes: text('owner_notes'),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('owner_statements_tenant_idx').on(table.tenantId),
    statementNumberTenantIdx: uniqueIndex('owner_statements_statement_number_tenant_idx').on(table.tenantId, table.statementNumber),
    propertyIdx: index('owner_statements_property_idx').on(table.propertyId),
    ownerIdx: index('owner_statements_owner_idx').on(table.ownerId),
    periodIdx: index('owner_statements_period_idx').on(table.periodStart, table.periodEnd),
    statusIdx: index('owner_statements_status_idx').on(table.status),
  })
);


// ============================================================================
// Additional Relations
// ============================================================================

export const receiptsRelations = relations(receipts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [receipts.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [receipts.customerId],
    references: [customers.id],
  }),
  payment: one(payments, {
    fields: [receipts.paymentId],
    references: [payments.id],
  }),
  invoice: one(invoices, {
    fields: [receipts.invoiceId],
    references: [invoices.id],
  }),
}));

export const paymentPlansRelations = relations(paymentPlans, ({ one }) => ({
  tenant: one(tenants, {
    fields: [paymentPlans.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [paymentPlans.customerId],
    references: [customers.id],
  }),
  lease: one(leases, {
    fields: [paymentPlans.leaseId],
    references: [leases.id],
  }),
}));

export const arrearsCasesRelations = relations(arrearsCases, ({ one }) => ({
  tenant: one(tenants, {
    fields: [arrearsCases.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [arrearsCases.customerId],
    references: [customers.id],
  }),
  lease: one(leases, {
    fields: [arrearsCases.leaseId],
    references: [leases.id],
  }),
  property: one(properties, {
    fields: [arrearsCases.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [arrearsCases.unitId],
    references: [units.id],
  }),
}));

export const ownerStatementsRelations = relations(ownerStatements, ({ one }) => ({
  tenant: one(tenants, {
    fields: [ownerStatements.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [ownerStatements.propertyId],
    references: [properties.id],
  }),
}));


