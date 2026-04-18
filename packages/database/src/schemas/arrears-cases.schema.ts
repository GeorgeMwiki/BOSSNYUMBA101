/**
 * Arrears Ledger schema (NEW 4 — MISSING_FEATURES_DESIGN §4)
 *
 * The immutable ledger is preserved. Adjustments are NEVER mutations;
 * they are append-only proposals that (once approved) produce a
 * related ledger entry referencing `related_entry_id`.
 *
 * Note: `arrears_cases` is already defined in payment.schema.ts (legacy
 * shape). This file introduces a PROJECTION-friendly companion suite:
 * `arrears_line_proposals` + the adjustment references so that the
 * projection service can replay ledger events deterministically.
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
import { customers } from './customer.schema.js';
import { invoices } from './payment.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const arrearsProposalStatusEnum = pgEnum(
  'arrears_proposal_status',
  ['pending', 'approved', 'rejected', 'cancelled']
);

export const arrearsProposalKindEnum = pgEnum('arrears_proposal_kind', [
  'waiver',
  'writeoff',
  'late_fee',
  'adjustment',
  'correction',
]);

// ============================================================================
// Arrears Line Proposals
//
// A proposal is immutable once created. Approval produces an associated
// ledger entry id (related_entry_id) — the ledger itself is never
// mutated.
// ============================================================================

export const arrearsLineProposals = pgTable(
  'arrears_line_proposals',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    arrearsCaseId: text('arrears_case_id').notNull(),
    invoiceId: text('invoice_id').references(() => invoices.id),

    // Nature of the proposal
    kind: arrearsProposalKindEnum('kind').notNull(),
    amountMinorUnits: integer('amount_minor_units').notNull(),
    currency: text('currency').notNull(),

    // Human-readable justification
    reason: text('reason').notNull(),
    evidenceDocIds: jsonb('evidence_doc_ids').default([]),

    // Approval workflow
    status: arrearsProposalStatusEnum('status').notNull().default('pending'),
    proposedBy: text('proposed_by').notNull(),
    proposedAt: timestamp('proposed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvalNotes: text('approval_notes'),

    rejectedBy: text('rejected_by'),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),

    // Link to the ledger entry created upon approval. Set ONCE on
    // approval — never updated or deleted.
    relatedEntryId: text('related_entry_id'),

    // Snapshot of projected balance at time of proposal
    balanceBeforeMinorUnits: integer('balance_before_minor_units'),
    projectedBalanceAfterMinorUnits: integer(
      'projected_balance_after_minor_units'
    ),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index('arrears_prop_tenant_idx').on(table.tenantId),
    caseIdx: index('arrears_prop_case_idx').on(table.arrearsCaseId),
    customerIdx: index('arrears_prop_customer_idx').on(table.customerId),
    statusIdx: index('arrears_prop_status_idx').on(table.status),
    relatedEntryIdx: index('arrears_prop_related_entry_idx').on(
      table.relatedEntryId
    ),
    proposedAtIdx: index('arrears_prop_proposed_at_idx').on(table.proposedAt),
  })
);

// ============================================================================
// Arrears Case Projections (read model for UI)
// Append-only projection snapshots — do NOT mutate after insert.
// ============================================================================

export const arrearsCaseProjections = pgTable(
  'arrears_case_projections',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    arrearsCaseId: text('arrears_case_id').notNull(),
    customerId: text('customer_id').notNull(),

    // Projected balance snapshot
    balanceMinorUnits: integer('balance_minor_units').notNull(),
    currency: text('currency').notNull(),

    // Aging
    daysPastDue: integer('days_past_due').notNull().default(0),
    agingBucket: text('aging_bucket').notNull(),

    // What was replayed into this snapshot
    lastLedgerEntryId: text('last_ledger_entry_id'),
    replayedEntryCount: integer('replayed_entry_count').notNull().default(0),

    // Line breakdown
    lines: jsonb('lines').notNull().default([]),

    // When
    asOf: timestamp('as_of', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index('arrears_proj_tenant_idx').on(table.tenantId),
    caseIdx: index('arrears_proj_case_idx').on(table.arrearsCaseId),
    customerIdx: index('arrears_proj_customer_idx').on(table.customerId),
    asOfIdx: index('arrears_proj_as_of_idx').on(table.asOf),
    caseAsOfUniq: uniqueIndex('arrears_proj_case_as_of_uniq').on(
      table.arrearsCaseId,
      table.asOf
    ),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const arrearsLineProposalsRelations = relations(
  arrearsLineProposals,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [arrearsLineProposals.tenantId],
      references: [tenants.id],
    }),
    customer: one(customers, {
      fields: [arrearsLineProposals.customerId],
      references: [customers.id],
    }),
    invoice: one(invoices, {
      fields: [arrearsLineProposals.invoiceId],
      references: [invoices.id],
    }),
  })
);

export const arrearsCaseProjectionsRelations = relations(
  arrearsCaseProjections,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [arrearsCaseProjections.tenantId],
      references: [tenants.id],
    }),
  })
);
