/**
 * Feedback + Complaints Schema (migration 0092).
 *
 * Closes Wave 18 gap: /api/v1/feedback + /api/v1/complaints shipped as
 * hardcoded fixture routers behind `liveDataRequired`. This schema backs
 * the real persistence.
 */

import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';

export const feedbackSubmissions = pgTable(
  'feedback_submissions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id'),
    type: text('type').notNull(),
    subject: text('subject').notNull(),
    message: text('message').notNull(),
    rating: integer('rating'),
    context: jsonb('context').default({}),
    status: text('status').notNull().default('submitted'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    resolutionNotes: text('resolution_notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantCreatedIdx: index('idx_feedback_submissions_tenant_created').on(
      t.tenantId,
      t.createdAt,
    ),
    statusIdx: index('idx_feedback_submissions_status').on(
      t.tenantId,
      t.status,
      t.createdAt,
    ),
    typeIdx: index('idx_feedback_submissions_type').on(
      t.tenantId,
      t.type,
      t.createdAt,
    ),
  }),
);

export const complaintRecords = pgTable(
  'complaint_records',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id'),
    customerId: text('customer_id'),
    subject: text('subject').notNull(),
    description: text('description').notNull(),
    category: text('category'),
    relatedEntityType: text('related_entity_type'),
    relatedEntityId: text('related_entity_id'),
    priority: text('priority').notNull().default('medium'),
    status: text('status').notNull().default('open'),
    resolution: text('resolution'),
    resolutionNotes: text('resolution_notes'),
    resolvedBy: text('resolved_by'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantCreatedIdx: index('idx_complaint_records_tenant_created').on(
      t.tenantId,
      t.createdAt,
    ),
    statusIdx: index('idx_complaint_records_status').on(
      t.tenantId,
      t.status,
      t.createdAt,
    ),
    customerIdx: index('idx_complaint_records_customer').on(
      t.tenantId,
      t.customerId,
      t.createdAt,
    ),
    priorityIdx: index('idx_complaint_records_priority').on(
      t.tenantId,
      t.priority,
      t.status,
    ),
  }),
);

export const feedbackSubmissionsRelations = relations(
  feedbackSubmissions,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [feedbackSubmissions.tenantId],
      references: [tenants.id],
    }),
  }),
);

export const complaintRecordsRelations = relations(
  complaintRecords,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [complaintRecords.tenantId],
      references: [tenants.id],
    }),
  }),
);
