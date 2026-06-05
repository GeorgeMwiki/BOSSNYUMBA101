/**
 * Housing-cooperative settlement schema (Wave COOPERATIVE-SETTLEMENT).
 *
 * BossNyumba's CLAUDE.md lists "housing cooperatives" as a first-class
 * audience. A housing cooperative aggregates a property's collected
 * pool — service-charge + sinking-fund + rent-share — over a period,
 * nets out operating expenses, then distributes the net-distributable
 * pool to its member households / owners by share.
 *
 * Companion to:
 *   - packages/database/src/migrations/0304_cooperative_settlement.sql
 *   - services/api-gateway/src/services/cooperative-settlement/
 *   - services/api-gateway/src/routes/cooperatives/cooperatives.hono.ts
 *
 * Two tables:
 *   - cooperative_settlement_periods       one row per (cooperative, period)
 *   - cooperative_member_distributions     per-member-household share within
 *                                          a period
 *
 * Money path (CLAUDE.md hard rule): the distribute step posts through
 * `LedgerService.post()` — NEVER a direct ledger write. The
 * `payment_ref` column carries the post-ledger handle for forensic
 * replay. Drafting + calculating only land snapshot rows; approve +
 * distribute stay behind the four-eye gate.
 *
 * Multi-currency (CLAUDE.md hard rule): amounts are currency-neutral
 * `numeric` columns paired with a `currency_code` text column. NOTHING
 * here hard-codes TZS / KES / UGX / NGN.
 *
 * Tenant scope: `app.current_tenant_id` GUC RLS, FORCE-enabled, bound by
 * the api-gateway database middleware. A housing cooperative is modelled
 * as a party (`cooperative_party_id`); each member is a household / owner
 * party (`member_household_party_id`). No FK to a party table is added
 * here so the migration depends only on already-shipped tables.
 *
 * Ported from Borjie's `cooperative-settlements.schema.ts` and retargeted
 * mining → real estate: mining cooperative → housing cooperative ·
 * royalty/sale revenue → service-charge + sinking-fund + rent-share ·
 * member miner → member household/owner · site → property.
 */

import {
  pgTable,
  text,
  timestamp,
  date,
  jsonb,
  uuid,
  numeric,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/** Settlement-period lifecycle. */
export const COOPERATIVE_PERIOD_STATUSES = [
  'draft',
  'calculated',
  'approved',
  'distributed',
  'contested',
] as const;
export type CooperativePeriodStatus =
  (typeof COOPERATIVE_PERIOD_STATUSES)[number];

export const cooperativeSettlementPeriods = pgTable(
  'cooperative_settlement_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    /** The housing cooperative (modelled as a party). */
    cooperativePartyId: uuid('cooperative_party_id').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    /** ISO-4217 code for every amount on this period. Never hard-coded. */
    currencyCode: text('currency_code').notNull().default('TZS'),
    // ── Collected pool (real-estate revenue lines) ────────────────────
    serviceChargeCollected: numeric('service_charge_collected', {
      precision: 18,
      scale: 2,
    })
      .notNull()
      .default('0'),
    sinkingFundCollected: numeric('sinking_fund_collected', {
      precision: 18,
      scale: 2,
    })
      .notNull()
      .default('0'),
    rentShareCollected: numeric('rent_share_collected', {
      precision: 18,
      scale: 2,
    })
      .notNull()
      .default('0'),
    /** Operating expenses netted out of the collected pool. */
    operatingExpenses: numeric('operating_expenses', {
      precision: 18,
      scale: 2,
    })
      .notNull()
      .default('0'),
    /**
     * Derived: max(0, service_charge + sinking_fund + rent_share −
     * operating_expenses). Persisted so the cockpit + chat tools can
     * read it without recomputing.
     */
    netDistributable: numeric('net_distributable', {
      precision: 18,
      scale: 2,
    })
      .notNull()
      .default('0'),
    status: text('status').notNull().default('draft'),
    approvedById: uuid('approved_by_id'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    distributedAt: timestamp('distributed_at', { withTimezone: true }),
    /** Set when approval crosses the four-eye threshold. */
    fourEyeRequestId: uuid('four_eye_request_id'),
    provenance: jsonb('provenance').notNull().default({ via: 'unknown' }),
    auditHashId: text('audit_hash_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantStatusIdx: index('cooperative_settlement_periods_tenant_status').on(
      table.tenantId,
      table.status,
      table.periodEnd,
    ),
    tenantPeriodUq: uniqueIndex(
      'cooperative_settlement_periods_tenant_period_uq',
    ).on(
      table.tenantId,
      table.cooperativePartyId,
      table.periodStart,
      table.periodEnd,
    ),
  }),
);

export type CooperativeSettlementPeriod =
  typeof cooperativeSettlementPeriods.$inferSelect;
export type NewCooperativeSettlementPeriod =
  typeof cooperativeSettlementPeriods.$inferInsert;

export const cooperativeMemberDistributions = pgTable(
  'cooperative_member_distributions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    periodId: uuid('period_id')
      .notNull()
      .references(() => cooperativeSettlementPeriods.id, {
        onDelete: 'cascade',
      }),
    /** The member household / owner receiving this share. */
    memberHouseholdPartyId: uuid('member_household_party_id').notNull(),
    sharePct: numeric('share_pct', { precision: 7, scale: 4 }).notNull(),
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    /** Post-ledger handle from LedgerService.post(). */
    paymentRef: text('payment_ref'),
    auditHashId: text('audit_hash_id'),
    provenance: jsonb('provenance').notNull().default({ via: 'unknown' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantPeriodIdx: index('cooperative_member_distributions_tenant_period').on(
      table.tenantId,
      table.periodId,
    ),
    periodMemberUq: uniqueIndex(
      'cooperative_member_distributions_period_member_uq',
    ).on(table.periodId, table.memberHouseholdPartyId),
  }),
);

export type CooperativeMemberDistribution =
  typeof cooperativeMemberDistributions.$inferSelect;
export type NewCooperativeMemberDistribution =
  typeof cooperativeMemberDistributions.$inferInsert;
