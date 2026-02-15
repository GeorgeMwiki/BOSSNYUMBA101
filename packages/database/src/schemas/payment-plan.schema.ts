/**
 * Payment Plan Agreement Schema
 * Installment payment plans for customers
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
import { tenants, users } from './tenant.schema.js';
import { customers } from './customer.schema.js';
import { leases } from './lease.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const paymentPlanStatusEnum = pgEnum('payment_plan_status', [
  'draft',
  'pending_approval',
  'approved',
  'active',
  'completed',
  'defaulted',
  'cancelled',
]);

// ============================================================================
// Payment Plan Agreements Table
// ============================================================================

export const paymentPlanAgreements = pgTable(
  'payment_plan_agreements',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => customers.id),
    leaseId: text('lease_id').references(() => leases.id),
    
    // Identity
    planNumber: text('plan_number').notNull(),
    
    // Amount
    totalAmount: integer('total_amount').notNull(), // In minor units
    currency: text('currency').notNull().default('KES'),
    
    // Installments (JSONB array)
    // Structure: [{ number, amount, dueDate, paidAmount, paidAt, status }]
    installments: jsonb('installments').notNull().default([]),
    
    // Status
    status: paymentPlanStatusEnum('status').notNull().default('draft'),
    
    // Approval
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by').references(() => users.id),
    
    // Tracking
    paidAmount: integer('paid_amount').notNull().default(0),
    remainingAmount: integer('remaining_amount').notNull(),
    nextDueDate: timestamp('next_due_date', { withTimezone: true }),
    nextDueAmount: integer('next_due_amount'),
    
    // Completion
    completedAt: timestamp('completed_at', { withTimezone: true }),
    
    // Default handling
    defaultedAt: timestamp('defaulted_at', { withTimezone: true }),
    defaultReason: text('default_reason'),
    
    // Terms
    terms: text('terms'),
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
    tenantIdx: index('payment_plan_agreements_tenant_idx').on(table.tenantId),
    numberTenantIdx: uniqueIndex('payment_plan_agreements_number_tenant_idx').on(table.tenantId, table.planNumber),
    customerIdx: index('payment_plan_agreements_customer_idx').on(table.customerId),
    leaseIdx: index('payment_plan_agreements_lease_idx').on(table.leaseId),
    statusIdx: index('payment_plan_agreements_status_idx').on(table.status),
    nextDueDateIdx: index('payment_plan_agreements_next_due_date_idx').on(table.nextDueDate),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const paymentPlanAgreementsRelations = relations(paymentPlanAgreements, ({ one }) => ({
  tenant: one(tenants, {
    fields: [paymentPlanAgreements.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [paymentPlanAgreements.customerId],
    references: [customers.id],
  }),
  lease: one(leases, {
    fields: [paymentPlanAgreements.leaseId],
    references: [leases.id],
  }),
  approver: one(users, {
    fields: [paymentPlanAgreements.approvedBy],
    references: [users.id],
  }),
}));
