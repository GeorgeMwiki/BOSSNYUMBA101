/**
 * GePG (Government e-Payment Gateway) schema
 *
 * Tracks control-number issuance and reconciliation events for the
 * Tanzanian government payment gateway (NEW 3 — MISSING_FEATURES_DESIGN §3).
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { invoices, payments } from './payment.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const gepgControlNumberStatusEnum = pgEnum(
  'gepg_control_number_status',
  ['pending', 'issued', 'rejected', 'paid', 'partial', 'expired', 'cancelled']
);

export const gepgReconEventTypeEnum = pgEnum('gepg_recon_event_type', [
  'cn_requested',
  'cn_issued',
  'cn_rejected',
  'callback_received',
  'callback_signature_failed',
  'reconciled',
  'reconciliation_failed',
  'duplicate_detected',
]);

// ============================================================================
// Control Numbers Table
// ============================================================================

export const gepgControlNumbers = pgTable(
  'gepg_control_numbers',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id),

    // GePG identifiers
    billId: text('bill_id').notNull(),
    controlNumber: text('control_number'),
    spCode: text('sp_code').notNull(),
    spSysId: text('sp_sys_id').notNull(),

    // Status
    status: gepgControlNumberStatusEnum('status').notNull().default('pending'),

    // Amount + currency
    amountMinorUnits: integer('amount_minor_units').notNull(),
    currency: text('currency').notNull(),
    paidAmountMinorUnits: integer('paid_amount_minor_units')
      .notNull()
      .default(0),

    // Payer info
    payerName: text('payer_name').notNull(),
    payerPhone: text('payer_phone'),
    payerEmail: text('payer_email'),

    // Lifecycle
    description: text('description'),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

    // Provider response
    pspReceiptNumber: text('psp_receipt_number'),
    pspChannel: text('psp_channel'),
    rawProviderResponse: jsonb('raw_provider_response').default({}),

    // Environment
    environment: text('environment').notNull().default('sandbox'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
  },
  (table) => ({
    tenantIdx: index('gepg_cn_tenant_idx').on(table.tenantId),
    invoiceIdx: index('gepg_cn_invoice_idx').on(table.invoiceId),
    controlNumberIdx: uniqueIndex('gepg_cn_control_number_uniq').on(
      table.controlNumber
    ),
    billIdTenantIdx: uniqueIndex('gepg_cn_bill_id_tenant_uniq').on(
      table.tenantId,
      table.billId
    ),
    statusIdx: index('gepg_cn_status_idx').on(table.status),
  })
);

// ============================================================================
// Reconciliation Events (append-only audit log)
// ============================================================================

export const gepgReconciliationEvents = pgTable(
  'gepg_reconciliation_events',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Links
    controlNumberId: text('control_number_id').references(
      () => gepgControlNumbers.id
    ),
    paymentId: text('payment_id').references(() => payments.id),

    // Event
    eventType: gepgReconEventTypeEnum('event_type').notNull(),
    controlNumber: text('control_number'),
    billId: text('bill_id'),

    // Payload snapshot
    payload: jsonb('payload').notNull().default({}),

    // Signature-related metadata (never store the actual key)
    signatureValid: text('signature_valid'), // "true" | "false" | null
    signatureReason: text('signature_reason'),

    // Dedup key — (tenantId, controlNumber, pspReceiptNumber)
    dedupKey: text('dedup_key'),

    // Occurrence
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
  },
  (table) => ({
    tenantIdx: index('gepg_recon_tenant_idx').on(table.tenantId),
    controlNumberIdx: index('gepg_recon_control_number_idx').on(
      table.controlNumber
    ),
    dedupKeyIdx: uniqueIndex('gepg_recon_dedup_uniq').on(table.dedupKey),
    eventTypeIdx: index('gepg_recon_event_type_idx').on(table.eventType),
    occurredAtIdx: index('gepg_recon_occurred_at_idx').on(table.occurredAt),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const gepgControlNumbersRelations = relations(
  gepgControlNumbers,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [gepgControlNumbers.tenantId],
      references: [tenants.id],
    }),
    invoice: one(invoices, {
      fields: [gepgControlNumbers.invoiceId],
      references: [invoices.id],
    }),
    events: many(gepgReconciliationEvents),
  })
);

export const gepgReconciliationEventsRelations = relations(
  gepgReconciliationEvents,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [gepgReconciliationEvents.tenantId],
      references: [tenants.id],
    }),
    controlNumberRecord: one(gepgControlNumbers, {
      fields: [gepgReconciliationEvents.controlNumberId],
      references: [gepgControlNumbers.id],
    }),
    payment: one(payments, {
      fields: [gepgReconciliationEvents.paymentId],
      references: [payments.id],
    }),
  })
);
