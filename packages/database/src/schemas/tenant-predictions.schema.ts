/**
 * tenant_predictions + predictive_intervention_opportunities (migration 0106).
 *
 * Nightly per-tenant probability distribution over outcomes for the next
 * 30/60/90 days (pay-on-time, late, default, churn, dispute). Combines
 * payment history, sentiment-monitor rollups, credit rating, tenancy
 * length, cases, and messages. Every prediction carries `model_version`,
 * `confidence`, and a free-form `explanation` so a human auditor can
 * understand why a tenant was flagged.
 *
 * `predictive_intervention_opportunities` is emitted whenever a probability
 * crosses an actionable threshold; the advisor surfaces the open set.
 */

import {
  pgTable,
  text,
  integer,
  doublePrecision,
  jsonb,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';

export const tenantPredictions = pgTable(
  'tenant_predictions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull(),
    horizonDays: integer('horizon_days').notNull(),
    probPayOnTime: doublePrecision('prob_pay_on_time').notNull(),
    probPayLate: doublePrecision('prob_pay_late').notNull(),
    probDefault: doublePrecision('prob_default').notNull(),
    probChurn: doublePrecision('prob_churn').notNull(),
    probDispute: doublePrecision('prob_dispute').notNull(),
    modelVersion: text('model_version').notNull(),
    confidence: doublePrecision('confidence').notNull(),
    explanation: text('explanation'),
    featureSnapshot: jsonb('feature_snapshot').notNull().default({}),
    promptHash: text('prompt_hash'),
    computedAt: timestamp('computed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    customerHorizonTimeIdx: index(
      'idx_tenant_predictions_customer_horizon_time',
    ).on(t.tenantId, t.customerId, t.horizonDays, t.computedAt.desc()),
    horizonCheck: check(
      'tenant_predictions_horizon_chk',
      sql`${t.horizonDays} IN (30, 60, 90)`,
    ),
    payOnTimeCheck: check(
      'tenant_predictions_pay_on_time_chk',
      sql`${t.probPayOnTime} BETWEEN 0 AND 1`,
    ),
    payLateCheck: check(
      'tenant_predictions_pay_late_chk',
      sql`${t.probPayLate} BETWEEN 0 AND 1`,
    ),
    defaultCheck: check(
      'tenant_predictions_default_chk',
      sql`${t.probDefault} BETWEEN 0 AND 1`,
    ),
    churnCheck: check(
      'tenant_predictions_churn_chk',
      sql`${t.probChurn} BETWEEN 0 AND 1`,
    ),
    disputeCheck: check(
      'tenant_predictions_dispute_chk',
      sql`${t.probDispute} BETWEEN 0 AND 1`,
    ),
    confidenceCheck: check(
      'tenant_predictions_confidence_chk',
      sql`${t.confidence} BETWEEN 0 AND 1`,
    ),
  }),
);

export const predictiveInterventionOpportunities = pgTable(
  'predictive_intervention_opportunities',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull(),
    predictionId: text('prediction_id'),
    signalType: text('signal_type').notNull(),
    signalStrength: doublePrecision('signal_strength').notNull(),
    suggestedAction: text('suggested_action'),
    status: text('status').notNull().default('open'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    openIdx: index('idx_predictive_interventions_open').on(
      t.tenantId,
      t.status,
      t.createdAt.desc(),
    ),
    signalStrengthCheck: check(
      'predictive_interventions_signal_chk',
      sql`${t.signalStrength} BETWEEN 0 AND 1`,
    ),
    statusCheck: check(
      'predictive_interventions_status_chk',
      sql`${t.status} IN ('open','acknowledged','acted','dismissed')`,
    ),
  }),
);

export type TenantPredictionRecord = typeof tenantPredictions.$inferSelect;
export type NewTenantPredictionRecord = typeof tenantPredictions.$inferInsert;
export type PredictiveInterventionOpportunityRecord =
  typeof predictiveInterventionOpportunities.$inferSelect;
export type NewPredictiveInterventionOpportunityRecord =
  typeof predictiveInterventionOpportunities.$inferInsert;
