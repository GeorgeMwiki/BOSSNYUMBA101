/**
 * Tenant Credit Rating Schema (0089).
 *
 * FICO-scale 300-850 rating with CRB-aligned bands, real-payment-only
 * inputs, per-tenant configurable weights, and opt-in cross-landlord
 * sharing. Mirrors the SQL in 0089_tenant_credit_rating.sql.
 */

import {
  pgTable,
  text,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { customers } from './customer.schema.js';

export const creditRatingLetterGradeEnum = pgEnum(
  'credit_rating_letter_grade',
  ['A', 'B', 'C', 'D', 'F'],
);

export const creditRatingBandEnum = pgEnum('credit_rating_band', [
  'excellent',
  'good',
  'fair',
  'poor',
  'very_poor',
  'insufficient_data',
]);

export const creditRatingPromiseKindEnum = pgEnum(
  'credit_rating_promise_kind',
  ['extension', 'installment', 'lease_amendment'],
);

export const creditRatingPromiseOutcomeEnum = pgEnum(
  'credit_rating_promise_outcome',
  ['on_time', 'late', 'defaulted', 'pending'],
);

export const creditRatingDataFreshnessEnum = pgEnum(
  'credit_rating_data_freshness',
  ['fresh', 'stale', 'unknown'],
);

export const creditRatingSnapshots = pgTable(
  'credit_rating_snapshots',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    numericScore: integer('numeric_score'),
    letterGrade: text('letter_grade'),
    band: text('band').notNull(),
    weakestFactor: text('weakest_factor'),
    strongestFactor: text('strongest_factor'),
    dataFreshness: text('data_freshness').notNull().default('unknown'),
    insufficientDataReason: text('insufficient_data_reason'),

    dimensions: jsonb('dimensions').notNull(),
    inputs: jsonb('inputs').notNull(),
    recommendations: jsonb('recommendations').notNull().default([]),

    computedAt: timestamp('computed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantIdx: index('idx_credit_rating_snapshots_tenant').on(
      t.tenantId,
      t.customerId,
      t.computedAt,
    ),
    bandIdx: index('idx_credit_rating_snapshots_band').on(t.tenantId, t.band),
    customerLatestIdx: index('idx_credit_rating_snapshots_customer_latest').on(
      t.customerId,
      t.computedAt,
    ),
  }),
);

export const creditRatingPromises = pgTable(
  'credit_rating_promises',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    kind: text('kind').notNull(),
    agreedDate: timestamp('agreed_date', { withTimezone: true }).notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    actualOutcome: text('actual_outcome').notNull(),
    delayDays: integer('delay_days').notNull().default(0),
    notes: text('notes'),

    recordedAt: timestamp('recorded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    recordedBy: text('recorded_by'),
  },
  (t) => ({
    tenantCustomerIdx: index('idx_credit_rating_promises_tenant_customer').on(
      t.tenantId,
      t.customerId,
      t.recordedAt,
    ),
    kindIdx: index('idx_credit_rating_promises_kind').on(
      t.tenantId,
      t.kind,
      t.recordedAt,
    ),
  }),
);

export const creditRatingWeights = pgTable('credit_rating_weights', {
  tenantId: text('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  paymentHistory: doublePrecision('payment_history').notNull().default(0.35),
  promiseKeeping: doublePrecision('promise_keeping').notNull().default(0.2),
  rentToIncome: doublePrecision('rent_to_income').notNull().default(0.2),
  tenancyLength: doublePrecision('tenancy_length').notNull().default(0.15),
  disputeHistory: doublePrecision('dispute_history').notNull().default(0.1),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: text('updated_by'),
});

export const creditRatingSharingOptIns = pgTable(
  'credit_rating_sharing_opt_ins',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    shareWithOrg: text('share_with_org').notNull(),
    purpose: text('purpose').notNull().default('tenancy_application'),

    grantedAt: timestamp('granted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    customerIdx: index('idx_credit_rating_sharing_opt_ins_customer').on(
      t.tenantId,
      t.customerId,
    ),
    activeIdx: index('idx_credit_rating_sharing_opt_ins_active').on(
      t.tenantId,
      t.customerId,
      t.expiresAt,
    ),
  }),
);

export const creditRatingSnapshotsRelations = relations(
  creditRatingSnapshots,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [creditRatingSnapshots.tenantId],
      references: [tenants.id],
    }),
    customer: one(customers, {
      fields: [creditRatingSnapshots.customerId],
      references: [customers.id],
    }),
  }),
);

export const creditRatingPromisesRelations = relations(
  creditRatingPromises,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [creditRatingPromises.tenantId],
      references: [tenants.id],
    }),
    customer: one(customers, {
      fields: [creditRatingPromises.customerId],
      references: [customers.id],
    }),
  }),
);

export const creditRatingSharingOptInsRelations = relations(
  creditRatingSharingOptIns,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [creditRatingSharingOptIns.tenantId],
      references: [tenants.id],
    }),
    customer: one(customers, {
      fields: [creditRatingSharingOptIns.customerId],
      references: [customers.id],
    }),
  }),
);
