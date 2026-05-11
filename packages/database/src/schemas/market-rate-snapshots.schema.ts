/**
 * market_rate_snapshots (migration 0103) — daily per-unit comparable-rent
 * rolling percentile band fed by the MarketRatePort abstraction.
 *
 * Concrete scrapers / data vendors are adapters (stubbed behind env
 * vars). Currency is ISO-4217 free-form text so new currencies are
 * addable without code changes. Every row records its `source_adapter`
 * and `market_sample_size` so downstream drift detection knows whether
 * to trust the comparable.
 *
 * Amounts stored as `BIGINT` minor units to avoid float drift on FX
 * conversion. `drift_flag` is one of 'below_market' | 'above_market' |
 * 'on_band' or NULL when sample size is too small to call.
 */

import {
  pgTable,
  text,
  integer,
  bigint,
  doublePrecision,
  jsonb,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';

export const marketRateSnapshots = pgTable(
  'market_rate_snapshots',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    unitId: text('unit_id').notNull(),
    propertyId: text('property_id'),
    currencyCode: text('currency_code').notNull(),
    ourRentAmountMinor: bigint('our_rent_amount_minor', {
      mode: 'number',
    }).notNull(),
    marketMedianMinor: bigint('market_median_minor', { mode: 'number' }),
    marketP25Minor: bigint('market_p25_minor', { mode: 'number' }),
    marketP75Minor: bigint('market_p75_minor', { mode: 'number' }),
    marketSampleSize: integer('market_sample_size').notNull().default(0),
    deltaPct: doublePrecision('delta_pct'),
    driftFlag: text('drift_flag'),
    compRadiusKm: doublePrecision('comp_radius_km'),
    sourceAdapter: text('source_adapter').notNull(),
    sourceMetadata: jsonb('source_metadata').notNull().default({}),
    modelVersion: text('model_version').notNull(),
    promptHash: text('prompt_hash'),
    observedAt: timestamp('observed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantUnitTimeIdx: index('idx_market_rate_snapshots_tenant_unit_time').on(
      t.tenantId,
      t.unitId,
      t.observedAt.desc(),
    ),
    driftIdx: index('idx_market_rate_snapshots_drift').on(
      t.tenantId,
      t.driftFlag,
      t.observedAt.desc(),
    ),
    sampleSizeCheck: check(
      'market_rate_snapshots_sample_size_chk',
      sql`${t.marketSampleSize} >= 0`,
    ),
    driftFlagCheck: check(
      'market_rate_snapshots_drift_flag_chk',
      sql`${t.driftFlag} IS NULL OR ${t.driftFlag} IN ('below_market', 'above_market', 'on_band')`,
    ),
  }),
);

export type MarketRateSnapshotRecord = typeof marketRateSnapshots.$inferSelect;
export type NewMarketRateSnapshotRecord =
  typeof marketRateSnapshots.$inferInsert;
