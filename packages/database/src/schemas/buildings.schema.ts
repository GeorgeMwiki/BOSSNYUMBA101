/**
 * Buildings / Floors / Parcel-Units / Rooms Schema —
 * Muzima spatial parcel engine (Wave-3 task #12).
 *
 * Mirrors migration `0164_spatial_parcels.sql`.
 *
 * Geometry columns are stored as text-GeoJSON at the Drizzle layer;
 * the underlying PostGIS column type is enforced by the migration.
 * See `parcels.schema.ts` header for the rationale.
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
import { parcels } from './parcels.schema.js';

// ============================================================================
// buildings
// ============================================================================

export const buildings = pgTable(
  'buildings',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    parcelId: text('parcel_id').notNull().references(() => parcels.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),

    footprint: text('footprint').notNull(),    // GeoJSON
    heightM: doublePrecision('height_m'),
    numFloors: integer('num_floors').notNull().default(1),
    h3R12: text('h3_r12'),

    authoritativeSource: text('authoritative_source').notNull().default('user_traced'),
    accuracyM: doublePrecision('accuracy_m').notNull().default(5.0),

    metadata: jsonb('metadata').notNull().default({}),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('buildings_tenant_idx').on(table.tenantId),
    parcelIdx: index('buildings_parcel_idx').on(table.parcelId),
    h3Idx: index('buildings_h3_r12_idx').on(table.h3R12),
  }),
);

export const buildingsRelations = relations(buildings, ({ one, many }) => ({
  parcel: one(parcels, {
    fields: [buildings.parcelId],
    references: [parcels.id],
  }),
}));

// ============================================================================
// floors
// ============================================================================

export const floors = pgTable(
  'floors',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    buildingId: text('building_id').notNull().references(() => buildings.id, { onDelete: 'cascade' }),
    level: integer('level').notNull(),
    name: text('name').notNull(),
    outline: text('outline'),     // GeoJSON, nullable for "missing footprint"
    areaSqm: doublePrecision('area_sqm'),
    heightM: doublePrecision('height_m'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('floors_tenant_idx').on(table.tenantId),
    buildingIdx: index('floors_building_idx').on(table.buildingId),
    buildingLevelUniq: uniqueIndex('floors_building_level_uniq').on(
      table.buildingId,
      table.level,
    ),
  }),
);

// ============================================================================
// parcel_units — geometric unit shape (NOT the leasable `units` table)
// ============================================================================

export const parcelUnits = pgTable(
  'parcel_units',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    floorId: text('floor_id').notNull().references(() => floors.id, { onDelete: 'cascade' }),
    // Optional link to the existing leasable `units` row. We avoid the
    // FK at the schema level to keep this package compilable in test
    // envs where the migration order may not have applied the
    // `units` table yet.
    leasableUnitId: text('leasable_unit_id'),
    unitCode: text('unit_code').notNull(),
    outline: text('outline').notNull(),   // GeoJSON Polygon
    areaSqm: doublePrecision('area_sqm').notNull(),
    occupancyStatus: text('occupancy_status').notNull().default('unknown'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('parcel_units_tenant_idx').on(table.tenantId),
    floorIdx: index('parcel_units_floor_idx').on(table.floorId),
  }),
);

// ============================================================================
// rooms
// ============================================================================

export const rooms = pgTable(
  'rooms',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    parcelUnitId: text('parcel_unit_id').notNull().references(() => parcelUnits.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    roomType: text('room_type').notNull().default('other'),
    outline: text('outline').notNull(),  // GeoJSON Polygon
    areaSqm: doublePrecision('area_sqm').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('rooms_tenant_idx').on(table.tenantId),
    parcelUnitIdx: index('rooms_parcel_unit_idx').on(table.parcelUnitId),
  }),
);

export type Building = typeof buildings.$inferSelect;
export type NewBuilding = typeof buildings.$inferInsert;
export type Floor = typeof floors.$inferSelect;
export type NewFloor = typeof floors.$inferInsert;
export type ParcelUnit = typeof parcelUnits.$inferSelect;
export type NewParcelUnit = typeof parcelUnits.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
