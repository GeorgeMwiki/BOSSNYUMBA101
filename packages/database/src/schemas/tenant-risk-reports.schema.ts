/**
 * Tenant Risk Reports Schema
 *
 * NEW-13: Composite risk report per customer combining payment-risk, churn,
 * financial statement health, and litigation history. The `narrative` field
 * holds LLM-generated prose; `snapshot` stores the deterministic scores so
 * we can reproduce the report independent of the LLM.
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { customers } from './customer.schema.js';

export const tenantRiskReportStatusEnum = pgEnum(
  'tenant_risk_report_status',
  ['draft', 'generated', 'archived'],
);

export const tenantRiskReports = pgTable(
  'tenant_risk_reports',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    status: tenantRiskReportStatusEnum('status').notNull().default('draft'),
    reportVersion: text('report_version').notNull().default('v1'),

    // Deterministic scores (0-100) — LOW is less risk for payment, HIGH
    // means more churn risk.
    paymentRiskScore: integer('payment_risk_score').notNull(),
    paymentRiskLevel: text('payment_risk_level').notNull(),
    churnRiskScore: integer('churn_risk_score').notNull(),
    churnRiskLevel: text('churn_risk_level').notNull(),

    // References
    financialStatementId: text('financial_statement_id'),
    litigationCount: integer('litigation_count').notNull().default(0),

    // Snapshot of inputs for reproducibility
    snapshot: jsonb('snapshot').notNull(),
    narrative: text('narrative'),
    recommendations: jsonb('recommendations').notNull().default([]),

    generatedAt: timestamp('generated_at', { withTimezone: true }),
    generatedBy: text('generated_by'),
    generatedByModel: text('generated_by_model'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index('tenant_risk_reports_tenant_idx').on(table.tenantId),
    customerIdx: index('tenant_risk_reports_customer_idx').on(table.customerId),
    statusIdx: index('tenant_risk_reports_status_idx').on(table.status),
    generatedAtIdx: index('tenant_risk_reports_generated_at_idx').on(
      table.generatedAt,
    ),
  }),
);

export const tenantRiskReportsRelations = relations(
  tenantRiskReports,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [tenantRiskReports.tenantId],
      references: [tenants.id],
    }),
    customer: one(customers, {
      fields: [tenantRiskReports.customerId],
      references: [customers.id],
    }),
  }),
);
