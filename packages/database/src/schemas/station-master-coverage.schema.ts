/**
 * Station Master Coverage + Worker Tags (NEW 18)
 *
 * `station_master_coverage` defines which portfolios/regions/tags a
 * station master is responsible for. `worker_tags` lets workers be
 * tagged for matching (e.g. "Nairobi East", "Plumbing", "KSW").
 *
 * Additive: does not touch existing auth or identity tables.
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

// ============================================================================
// Enums
// ============================================================================

export const coverageKindEnum = pgEnum('station_master_coverage_kind', [
  'tag',
  'polygon',      // reserved for GeoNode hierarchy — KI-010 tracks wiring.
  'city',
  'property_ids',
  'region',
]);

// ============================================================================
// station_master_coverage
// ============================================================================

export const stationMasterCoverage = pgTable(
  'station_master_coverage',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    stationMasterId: text('station_master_id').notNull(),

    coverageKind: coverageKindEnum('coverage_kind').notNull(),
    /**
     * Shape depends on coverageKind:
     *   tag:          { tag: string }
     *   polygon:      { geoJson: GeoJSON.Polygon }
     *   city:         { city: string, country?: string }
     *   property_ids: { propertyIds: string[] }
     *   region:       { regionId: string }
     */
    coverageValue: jsonb('coverage_value').notNull(),

    priority: integer('priority').notNull().default(100),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('station_master_coverage_tenant_idx').on(table.tenantId),
    stationMasterIdx: index(
      'station_master_coverage_station_master_idx'
    ).on(table.stationMasterId),
    coverageKindIdx: index('station_master_coverage_kind_idx').on(
      table.coverageKind
    ),
    priorityIdx: index('station_master_coverage_priority_idx').on(
      table.priority
    ),
  })
);

// ============================================================================
// worker_tags
// ============================================================================

export const workerTags = pgTable(
  'worker_tags',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    tag: text('tag').notNull(),
    metadata: jsonb('metadata').default({}),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
  },
  (table) => ({
    tenantIdx: index('worker_tags_tenant_idx').on(table.tenantId),
    userIdx: index('worker_tags_user_idx').on(table.userId),
    tagIdx: index('worker_tags_tag_idx').on(table.tag),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const stationMasterCoverageRelations = relations(
  stationMasterCoverage,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [stationMasterCoverage.tenantId],
      references: [tenants.id],
    }),
  })
);

export const workerTagsRelations = relations(workerTags, ({ one }) => ({
  tenant: one(tenants, {
    fields: [workerTags.tenantId],
    references: [tenants.id],
  }),
}));
