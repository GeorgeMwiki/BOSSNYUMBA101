/**
 * Muzima Spatial Parcel Schema (Wave-3 task #12).
 *
 * Drizzle definitions for the Muzima spatial polygon store originally
 * created by migration `0164d_spatial_parcels.sql` as table `parcels`.
 *
 * TABLE RENAME — migration `0252b_muzima_parcels_rename_preempt.sql`:
 *   The newer Piece-N land-subdivision engine (`0253_parcels.sql` + the
 *   0254-0260 cluster) needs to own the `parcels` name, so on a fresh DB
 *   `0252b` renames this Muzima table `parcels` -> `muzima_parcels`. This
 *   model therefore maps `muzima_parcels`. `0252b` renames the TABLE only —
 *   the indexes keep their original `parcels_*` names (and the buildings/
 *   floors/parcel_units FKs follow the rename by OID), which is why the
 *   index labels below are left unchanged.
 *   The Piece-N `parcels` table has NO Drizzle model in this package; it is
 *   served by the pure-domain `@bossnyumba/geo-parcels` engine + the
 *   `services/parcel-service` in-memory `ParcelStore`.
 *
 * GEOMETRY AS TEXT (pragmatic choice):
 *   Drizzle ships no first-class PostGIS column type, so geometry columns
 *   are exposed as `text` and treated as GeoJSON at the application
 *   boundary — the parcel-service casts them with `ST_GeomFromGeoJSON()`
 *   on write and `ST_AsGeoJSON()` on read. The spatial indexes still live
 *   in the database (see migration 0164d).
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
// muzima_parcels  (renamed from `parcels` by migration 0252b)
// ============================================================================

export const muzimaParcels = pgTable(
  'muzima_parcels',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').references(() => properties.id, { onDelete: 'set null' }),
    name: text('name').notNull(),

    // Stored as GeoJSON text. The DB columns are PostGIS
    // `geometry(MultiPolygon, 4326)` / `geometry(Point, 4326)` — see migration 0164d.
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
  // Index labels retain their original `parcels_*` identifiers: 0252b renamed
  // the table, not its indexes, so these mirror the live DB index names.
  (table) => ({
    tenantIdx: index('parcels_tenant_idx').on(table.tenantId),
    propertyIdx: index('parcels_property_idx').on(table.propertyId),
    h3Idx: index('parcels_h3_r10_idx').on(table.h3R10),
  }),
);

export const muzimaParcelsRelations = relations(muzimaParcels, ({ one }) => ({
  tenant: one(tenants, {
    fields: [muzimaParcels.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [muzimaParcels.propertyId],
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

export type MuzimaParcel = typeof muzimaParcels.$inferSelect;
export type NewMuzimaParcel = typeof muzimaParcels.$inferInsert;
export type MapLayerRow = typeof mapLayers.$inferSelect;
export type NewMapLayerRow = typeof mapLayers.$inferInsert;
