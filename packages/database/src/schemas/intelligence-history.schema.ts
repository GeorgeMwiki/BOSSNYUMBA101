/**
 * Intelligence History Schema
 *
 * SCAFFOLDED-14: daily snapshots of per-customer intelligence signals
 * (payment risk, churn, NBA status, sentiment). Used for trend lines and
 * retroactive model audits.
 *
 * Snapshots are append-only; the (tenant_id, customer_id, snapshot_date)
 * tuple is unique so re-running the job is idempotent.
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  decimal,
  jsonb,
  index,
  uniqueIndex,
  date,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { customers } from './customer.schema.js';

export const intelligenceHistory = pgTable(
  'intelligence_history',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    snapshotDate: date('snapshot_date').notNull(),

    // Deterministic scores (0-100)
    paymentRiskScore: integer('payment_risk_score'),
    paymentRiskLevel: text('payment_risk_level'),
    churnRiskScore: integer('churn_risk_score'),
    churnRiskLevel: text('churn_risk_level'),

    // Additional signals
    sentimentScore: decimal('sentiment_score', { precision: 4, scale: 2 }),
    openMaintenanceCount: integer('open_maintenance_count').notNull().default(0),
    complaintsLast30Days: integer('complaints_last_30_days').notNull().default(0),
    paymentsLast30DaysOnTime: integer('payments_last_30_days_on_time')
      .notNull()
      .default(0),
    paymentsLast30DaysLate: integer('payments_last_30_days_late')
      .notNull()
      .default(0),

    // Raw sub-scores for auditability
    paymentSubScores: jsonb('payment_sub_scores'),
    churnSubScores: jsonb('churn_sub_scores'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index('intelligence_history_tenant_idx').on(table.tenantId),
    customerIdx: index('intelligence_history_customer_idx').on(
      table.customerId,
    ),
    dateIdx: index('intelligence_history_date_idx').on(table.snapshotDate),
    customerDateUnique: uniqueIndex(
      'intelligence_history_customer_date_unique',
    ).on(table.tenantId, table.customerId, table.snapshotDate),
  }),
);

export const intelligenceHistoryRelations = relations(
  intelligenceHistory,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [intelligenceHistory.tenantId],
      references: [tenants.id],
    }),
    customer: one(customers, {
      fields: [intelligenceHistory.customerId],
      references: [customers.id],
    }),
  }),
);
