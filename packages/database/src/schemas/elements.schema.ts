/**
 * Elements + Element-Photos + Reference Building Caches —
 * Muzima spatial parcel engine (Wave-3 task #12).
 *
 * Mirrors migration `0164_spatial_parcels.sql`.
 *
 * Geometry columns are stored as text-GeoJSON at the Drizzle layer;
 * the underlying PostGIS column type is enforced by the migration.
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
import { tenants } from './tenant.schema.js';
import { buildings, floors, parcelUnits, rooms } from './buildings.schema.js';

// ============================================================================
// elements
// ============================================================================

export const elements = pgTable(
  'elements',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

    // One-of-three parent attachment (enforced by SQL CHECK in 0164):
    roomId: text('room_id').references(() => rooms.id, { onDelete: 'cascade' }),
    parcelUnitId: text('parcel_unit_id').references(() => parcelUnits.id, { onDelete: 'cascade' }),
    buildingId: text('building_id').references(() => buildings.id, { onDelete: 'cascade' }),

    elementType: text('element_type').notNull(),
    status: text('status').notNull().default('unknown'),
    condition: text('condition').notNull().default('unknown'),

    geom: text('geom').notNull(),    // GeoJSON Point/LineString/Polygon

    metadata: jsonb('metadata').notNull().default({}),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('elements_tenant_idx').on(table.tenantId),
    roomIdx: index('elements_room_idx').on(table.roomId),
    typeIdx: index('elements_type_idx').on(table.elementType),
    statusIdx: index('elements_status_idx').on(table.status),
  }),
);

// ============================================================================
// element_photos
// ============================================================================

export const elementPhotos = pgTable(
  'element_photos',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    elementId: text('element_id').notNull().references(() => elements.id, { onDelete: 'cascade' }),
    storageUrl: text('storage_url').notNull(),
    captureGeom: text('capture_geom'),    // GeoJSON Point
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    uploadedBy: text('uploaded_by'),
    widthPx: integer('width_px'),
    heightPx: integer('height_px'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('element_photos_tenant_idx').on(table.tenantId),
    elementIdx: index('element_photos_element_idx').on(table.elementId),
  }),
);

// ============================================================================
// ref_overture_buildings — global open-data cache
// ============================================================================

export const refOvertureBuildings = pgTable(
  'ref_overture_buildings',
  {
    id: text('id').primaryKey(),
    overtureId: text('overture_id').notNull(),
    footprint: text('footprint').notNull(),   // GeoJSON
    heightM: doublePrecision('height_m'),
    numFloors: integer('num_floors'),
    countryCode: text('country_code'),
    releaseTag: text('release_tag').notNull().default('2026-04-15.0'),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    countryIdx: index('ref_overture_country_idx').on(table.countryCode),
    overtureIdUniq: uniqueIndex('ref_overture_overture_id_uniq').on(
      table.overtureId,
      table.releaseTag,
    ),
  }),
);

// ============================================================================
// ref_google_open_buildings — global open-data cache
// ============================================================================

export const refGoogleOpenBuildings = pgTable(
  'ref_google_open_buildings',
  {
    id: text('id').primaryKey(),
    googleId: text('google_id').notNull(),
    footprint: text('footprint').notNull(),   // GeoJSON
    areaSqm: doublePrecision('area_sqm'),
    confidence: doublePrecision('confidence'),
    countryCode: text('country_code'),
    releaseTag: text('release_tag').notNull().default('v3'),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    countryIdx: index('ref_google_open_country_idx').on(table.countryCode),
    googleIdUniq: uniqueIndex('ref_google_open_google_id_uniq').on(
      table.googleId,
      table.releaseTag,
    ),
  }),
);

export type Element = typeof elements.$inferSelect;
export type NewElement = typeof elements.$inferInsert;
export type ElementPhoto = typeof elementPhotos.$inferSelect;
export type NewElementPhoto = typeof elementPhotos.$inferInsert;
export type RefOvertureBuilding = typeof refOvertureBuildings.$inferSelect;
export type RefGoogleOpenBuilding = typeof refGoogleOpenBuildings.$inferSelect;
