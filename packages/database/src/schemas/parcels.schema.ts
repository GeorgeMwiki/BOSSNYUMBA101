/**
 * Parcels Schema — Muzima spatial parcel engine (Wave-3 task #12).
 *
 * Drizzle definitions mirroring migration `0164_spatial_parcels.sql`.
 *
 * IMPORTANT (pragmatic choice):
 *   Drizzle does not ship a first-class PostGIS column type. Wiring
 *   `pgcustom` for geometry columns is fiddly because PostGIS expects
 *   WKT/WKB on write and returns EWKT/EWKB on read. To keep the ORM
 *   layer ergonomic *and* tooling-friendly we expose geometry columns
 *   as `text` and treat them as GeoJSON strings at the application
 *   boundary — the parcel-service casts them with
 *   `ST_GeomFromGeoJSON()` on write and `ST_AsGeoJSON()` on read. The
 *   spatial indexes still live in the database (see migration).
 *
 * Spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md`
 */

import {
  pgTable,
  text,
  timestamp,
  doublePrecision,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { properties } from './property.schema.js';

// ============================================================================
// parcels
// ============================================================================

export const parcels = pgTable(
  'parcels',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').references(() => properties.id, { onDelete: 'set null' }),
    name: text('name').notNull(),

    // Stored as GeoJSON text. The DB column itself is PostGIS
    // `geometry(MultiPolygon, 4326)` — see migration 0164.
    boundary: text('boundary').notNull(),
    centroid: text('centroid').notNull(),

    areaSqm: doublePrecision('area_sqm').notNull(),
    h3R10: text('h3_r10'),

    authoritativeSource: text('authoritative_source').notNull().default('user_traced'),
    accuracyM: doublePrecision('accuracy_m').notNull().default(5.0),

    metadata: jsonb('metadata').notNull().default({}),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('parcels_tenant_idx').on(table.tenantId),
    propertyIdx: index('parcels_property_idx').on(table.propertyId),
    h3Idx: index('parcels_h3_r10_idx').on(table.h3R10),
  }),
);

export const parcelsRelations = relations(parcels, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [parcels.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [parcels.propertyId],
    references: [properties.id],
  }),
}));

// ============================================================================
// map_layers
// ============================================================================

export const mapLayers = pgTable(
  'map_layers',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // 'occupancy' | 'condition' | 'status' | 'arrears' | 'compliance'
    // | 'maintenance' | 'rent_band' | 'custom' — see migration 0164 CHECK.
    layerKind: text('layer_kind').notNull(),
    style: jsonb('style').notNull().default({}),
    isDefault: integer('is_default').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('map_layers_tenant_idx').on(table.tenantId),
    tenantKindUniq: uniqueIndex('map_layers_tenant_default_uniq').on(
      table.tenantId,
      table.layerKind,
    ),
  }),
);

export type Parcel = typeof parcels.$inferSelect;
export type NewParcel = typeof parcels.$inferInsert;
export type MapLayerRow = typeof mapLayers.$inferSelect;
export type NewMapLayerRow = typeof mapLayers.$inferInsert;
