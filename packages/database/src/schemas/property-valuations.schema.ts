/**
 * Property Valuations — migration 0090.
 *
 * Latest-wins per-property appraisal amounts. Consumed by
 * `LiveMetricsSource.fetchPortfolioWeightHints()` in property-grading
 * to weight portfolio rollups by asset value instead of equal-weight.
 *
 * Amount stored in minor units (BIGINT / `bigint` in drizzle) to match
 * the rest of the payments + ledger schemas.
 */

import {
  pgTable,
  text,
  bigint,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { properties } from './property.schema.js';

export const propertyValuations = pgTable(
  'property_valuations',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),

    amountMinorUnits: bigint('amount_minor_units', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),

    source: text('source').notNull().default('appraisal'),
    appraiserName: text('appraiser_name'),
    reportUrl: text('report_url'),

    valuedAt: timestamp('valued_at', { withTimezone: true }).notNull(),

    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (t) => ({
    tenantPropertyIdx: index('idx_property_valuations_tenant_property').on(
      t.tenantId,
      t.propertyId,
      t.valuedAt,
    ),
    latestIdx: index('idx_property_valuations_latest').on(
      t.tenantId,
      t.valuedAt,
    ),
  }),
);

export const propertyValuationsRelations = relations(
  propertyValuations,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [propertyValuations.tenantId],
      references: [tenants.id],
    }),
    property: one(properties, {
      fields: [propertyValuations.propertyId],
      references: [properties.id],
    }),
  }),
);

export type PropertyValuationRow = typeof propertyValuations.$inferSelect;
export type NewPropertyValuationRow = typeof propertyValuations.$inferInsert;
