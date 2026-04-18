/**
 * Gamification schema (NEW 9 — MISSING_FEATURES_DESIGN §9)
 *
 * 3-layer architecture (per RESEARCH_ANSWERS.md Q3, Till-model):
 *   1) Tenant score: internal reputation score, no cash out.
 *   2) Early-pay credit: off-ledger reward bucket redeemable on the
 *      next invoice — settled by proposing an arrears adjustment
 *      (never a direct ledger mutation).
 *   3) MNO cashback hook: optional, per-tenant, settled via PSP B2C.
 *
 * Events are append-only. Tenant profile snapshots are also
 * append-only — current state is derived by reading the latest
 * `as_of` row.
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { customers } from './customer.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const rewardTierEnum = pgEnum('reward_tier', [
  'bronze',
  'silver',
  'gold',
  'platinum',
]);

export const rewardEventTypeEnum = pgEnum('reward_event_type', [
  'payment_posted',
  'on_time_payment',
  'early_payment',
  'late_payment',
  'streak_continued',
  'streak_broken',
  'tier_upgraded',
  'tier_downgraded',
  'early_pay_credit_granted',
  'early_pay_credit_redeemed',
  'cashback_queued',
  'cashback_paid',
  'late_fee_applied',
  'policy_updated',
]);

// ============================================================================
// Reward Policies (per-tenant)
// ============================================================================

export const rewardPolicies = pgTable(
  'reward_policies',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Policy versioning — never update a policy; create a new version.
    version: integer('version').notNull().default(1),
    active: boolean('active').notNull().default(true),

    // Layer 1: scoring
    onTimePoints: integer('on_time_points').notNull().default(10),
    earlyPaymentBonusPoints: integer('early_payment_bonus_points')
      .notNull()
      .default(5),
    latePenaltyPoints: integer('late_penalty_points').notNull().default(-15),
    streakBonusPoints: integer('streak_bonus_points').notNull().default(2),

    // Tier thresholds (score)
    bronzeThreshold: integer('bronze_threshold').notNull().default(0),
    silverThreshold: integer('silver_threshold').notNull().default(100),
    goldThreshold: integer('gold_threshold').notNull().default(300),
    platinumThreshold: integer('platinum_threshold').notNull().default(600),

    // Layer 2: early-pay credit
    earlyPayDiscountBps: integer('early_pay_discount_bps').notNull().default(0),
    earlyPayMinDaysBefore: integer('early_pay_min_days_before')
      .notNull()
      .default(3),
    earlyPayMaxCreditMinor: integer('early_pay_max_credit_minor')
      .notNull()
      .default(0),

    // Late fee
    lateFeeBps: integer('late_fee_bps').notNull().default(0),
    lateFeeGraceDays: integer('late_fee_grace_days').notNull().default(3),
    lateFeeMaxMinor: integer('late_fee_max_minor').notNull().default(0),

    // Layer 3: MNO cashback (OFF by default)
    cashbackEnabled: boolean('cashback_enabled').notNull().default(false),
    cashbackBps: integer('cashback_bps').notNull().default(0),
    cashbackMonthlyCapMinor: integer('cashback_monthly_cap_minor')
      .notNull()
      .default(0),
    cashbackProvider: text('cashback_provider'), // 'mpesa_b2c', 'airtel_b2c'

    // Raw policy JSON for future extension
    extra: jsonb('extra').default({}),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true })
      .notNull()
      .defaultNow(),
    effectiveUntil: timestamp('effective_until', { withTimezone: true }),
  },
  (table) => ({
    tenantIdx: index('reward_policy_tenant_idx').on(table.tenantId),
    tenantVersionUniq: uniqueIndex('reward_policy_tenant_version_uniq').on(
      table.tenantId,
      table.version
    ),
    activeIdx: index('reward_policy_active_idx').on(table.active),
  })
);

// ============================================================================
// Tenant Gamification Profile (per customer, per-tenant)
// Append-only snapshots — latest asOf row = current state.
// ============================================================================

export const tenantGamificationProfile = pgTable(
  'tenant_gamification_profile',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),

    // Layer 1
    score: integer('score').notNull().default(0),
    tier: rewardTierEnum('tier').notNull().default('bronze'),
    streakMonths: integer('streak_months').notNull().default(0),
    longestStreakMonths: integer('longest_streak_months').notNull().default(0),
    totalOnTimePayments: integer('total_on_time_payments').notNull().default(0),
    totalLatePayments: integer('total_late_payments').notNull().default(0),

    // Layer 2
    earlyPayCreditBalanceMinor: integer('early_pay_credit_balance_minor')
      .notNull()
      .default(0),
    earlyPayCreditCurrency: text('early_pay_credit_currency'),

    // Layer 3
    cashbackMonthToDateMinor: integer('cashback_month_to_date_minor')
      .notNull()
      .default(0),
    cashbackLifetimeMinor: integer('cashback_lifetime_minor')
      .notNull()
      .default(0),

    // Provenance
    asOf: timestamp('as_of', { withTimezone: true }).notNull().defaultNow(),
    sourceEventId: text('source_event_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index('gm_profile_tenant_idx').on(table.tenantId),
    customerIdx: index('gm_profile_customer_idx').on(table.customerId),
    tenantCustomerAsOfUniq: uniqueIndex(
      'gm_profile_tenant_customer_as_of_uniq'
    ).on(table.tenantId, table.customerId, table.asOf),
    tierIdx: index('gm_profile_tier_idx').on(table.tier),
  })
);

// ============================================================================
// Reward Events (append-only log)
// ============================================================================

export const rewardEvents = pgTable(
  'reward_events',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),

    eventType: rewardEventTypeEnum('event_type').notNull(),
    policyId: text('policy_id').references(() => rewardPolicies.id),

    // Event specifics
    scoreDelta: integer('score_delta').notNull().default(0),
    creditDeltaMinor: integer('credit_delta_minor').notNull().default(0),
    cashbackDeltaMinor: integer('cashback_delta_minor').notNull().default(0),
    currency: text('currency'),

    // Context
    paymentId: text('payment_id'),
    invoiceId: text('invoice_id'),
    fromTier: rewardTierEnum('from_tier'),
    toTier: rewardTierEnum('to_tier'),

    // Arbitrary payload
    payload: jsonb('payload').default({}),

    // Idempotency
    dedupKey: text('dedup_key'),

    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index('reward_event_tenant_idx').on(table.tenantId),
    customerIdx: index('reward_event_customer_idx').on(table.customerId),
    typeIdx: index('reward_event_type_idx').on(table.eventType),
    dedupUniq: uniqueIndex('reward_event_dedup_uniq').on(table.dedupKey),
    occurredAtIdx: index('reward_event_occurred_at_idx').on(table.occurredAt),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const rewardPoliciesRelations = relations(
  rewardPolicies,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [rewardPolicies.tenantId],
      references: [tenants.id],
    }),
    events: many(rewardEvents),
  })
);

export const tenantGamificationProfileRelations = relations(
  tenantGamificationProfile,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [tenantGamificationProfile.tenantId],
      references: [tenants.id],
    }),
    customer: one(customers, {
      fields: [tenantGamificationProfile.customerId],
      references: [customers.id],
    }),
  })
);

export const rewardEventsRelations = relations(rewardEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [rewardEvents.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [rewardEvents.customerId],
    references: [customers.id],
  }),
  policy: one(rewardPolicies, {
    fields: [rewardEvents.policyId],
    references: [rewardPolicies.id],
  }),
}));
