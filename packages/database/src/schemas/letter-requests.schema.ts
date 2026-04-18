/**
 * Letter Requests Schema
 *
 * On-demand tenant letters (NEW 10): residency proof, tenancy confirmation,
 * payment confirmation, tenant reference. Tracks request → draft → approval
 * → issued workflow, linking to ApprovalService and to the rendered document.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenant.schema.js';
import { customers } from './customer.schema.js';

export const letterTypeEnum = pgEnum('letter_type', [
  'residency_proof',
  'tenancy_confirmation',
  'payment_confirmation',
  'tenant_reference',
]);

export const letterRequestStatusEnum = pgEnum('letter_request_status', [
  'requested',
  'drafted',
  'pending_approval',
  'approved',
  'issued',
  'rejected',
  'cancelled',
]);

export const letterRequests = pgTable(
  'letter_requests',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),

    letterType: letterTypeEnum('letter_type').notNull(),
    status: letterRequestStatusEnum('status').notNull().default('requested'),

    // Structured request payload: lease id, requestedBy, purpose, etc.
    requestPayload: jsonb('request_payload').notNull().default({}),

    // Rendered draft content + render-job link.
    draftContent: text('draft_content'),
    renderJobId: text('render_job_id'),

    // Approval workflow integration.
    approvalId: text('approval_id'),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),

    // Final artifact (the document in document_uploads once issued).
    issuedDocumentId: text('issued_document_id'),
    issuedAt: timestamp('issued_at', { withTimezone: true }),

    requestedBy: text('requested_by').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('letter_requests_tenant_idx').on(table.tenantId),
    customerIdx: index('letter_requests_customer_idx').on(table.customerId),
    statusIdx: index('letter_requests_status_idx').on(table.status),
    typeIdx: index('letter_requests_type_idx').on(table.letterType),
  })
);

export type LetterRequest = typeof letterRequests.$inferSelect;
export type NewLetterRequest = typeof letterRequests.$inferInsert;
