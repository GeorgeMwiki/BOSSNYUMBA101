/**
 * Land Parcels & Portions Schema
 * Manages barelands, railway reserve parcels, and subdivisions
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { customers } from './customer.schema.js';
import { leases } from './lease.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const parcelTypeEnum = pgEnum('parcel_type', [
  'bareland',
  'railway_reserve',
  'residential',
  'commercial',
  'industrial',
  'mixed',
  'other',
]);

export const parcelStatusEnum = pgEnum('parcel_status', [
  'available',
  'leased',
  'partially_leased',
  'subdivided',
  'reserved',
  'disputed',
  'under_survey',
  'archived',
]);

// ============================================================================
// Land Parcels Table
// ============================================================================

export const landParcels = pgTable(
  'land_parcels',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    parentParcelId: text('parent_parcel_id'), // Self-ref for subdivision hierarchy

    // Identity
    parcelCode: text('parcel_code').notNull(),
    name: text('name').notNull(),
    type: parcelTypeEnum('type').notNull(),
    status: parcelStatusEnum('status').notNull().default('available'),
    description: text('description'),

    // Area
    totalAreaSqm: decimal('total_area_sqm', { precision: 14, scale: 2 }).notNull(),
    leasedAreaSqm: decimal('leased_area_sqm', { precision: 14, scale: 2 }).default('0'),
    availableAreaSqm: decimal('available_area_sqm', { precision: 14, scale: 2 }).notNull(),

    // Organization (district/station)
    districtOrgId: text('district_org_id'), // FK to organizations
    stationOrgId: text('station_org_id'),   // FK to organizations

    // Railway reserve flag
    nearRailwayReserve: boolean('near_railway_reserve').notNull().default(false),
    requiresCivilEngNotification: boolean('requires_civil_eng_notification').notNull().default(false),

    // Location
    addressLine1: text('address_line1'),
    city: text('city'),
    region: text('region'),
    latitude: decimal('latitude', { precision: 10, scale: 8 }),
    longitude: decimal('longitude', { precision: 11, scale: 8 }),
    boundaryCoordinates: jsonb('boundary_coordinates').default([]), // [{lat, lng}] polygon
    mapUrl: text('map_url'), // Google Maps link

    // Legal & Survey
    cadastralReference: text('cadastral_reference'),
    titleDeedNumber: text('title_deed_number'),
    titleDeedDocumentUrl: text('title_deed_document_url'),
    surveyorName: text('surveyor_name'),
    surveyDate: timestamp('survey_date', { withTimezone: true }),
    surveyDocumentUrl: text('survey_document_url'),

    // Media
    images: jsonb('images').default([]),
    documents: jsonb('documents').default([]),

    // Notes
    notes: text('notes'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('land_parcels_tenant_idx').on(table.tenantId),
    codeTenantIdx: uniqueIndex('land_parcels_code_tenant_idx').on(table.tenantId, table.parcelCode),
    parentIdx: index('land_parcels_parent_idx').on(table.parentParcelId),
    statusIdx: index('land_parcels_status_idx').on(table.status),
    typeIdx: index('land_parcels_type_idx').on(table.type),
    districtIdx: index('land_parcels_district_idx').on(table.districtOrgId),
    stationIdx: index('land_parcels_station_idx').on(table.stationOrgId),
    railwayReserveIdx: index('land_parcels_railway_reserve_idx').on(table.nearRailwayReserve),
  })
);

// ============================================================================
// Parcel Portions Table (Subdivisions)
// ============================================================================

export const parcelPortions = pgTable(
  'parcel_portions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    parcelId: text('parcel_id').notNull().references(() => landParcels.id, { onDelete: 'cascade' }),

    // Identity
    portionCode: text('portion_code').notNull(),
    portionNumber: integer('portion_number').notNull(),
    name: text('name'),

    // Area
    areaSqm: decimal('area_sqm', { precision: 14, scale: 2 }).notNull(),

    // Status
    status: parcelStatusEnum('status').notNull().default('available'),

    // Occupancy
    leaseId: text('lease_id').references(() => leases.id),
    customerId: text('customer_id').references(() => customers.id),

    // Location
    latitude: decimal('latitude', { precision: 10, scale: 8 }),
    longitude: decimal('longitude', { precision: 11, scale: 8 }),
    boundaryCoordinates: jsonb('boundary_coordinates').default([]),

    // Notes
    notes: text('notes'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('parcel_portions_tenant_idx').on(table.tenantId),
    parcelIdx: index('parcel_portions_parcel_idx').on(table.parcelId),
    codeParcelIdx: uniqueIndex('parcel_portions_code_parcel_idx').on(table.parcelId, table.portionCode),
    statusIdx: index('parcel_portions_status_idx').on(table.status),
    leaseIdx: index('parcel_portions_lease_idx').on(table.leaseId),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const landParcelsRelations = relations(landParcels, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [landParcels.tenantId],
    references: [tenants.id],
  }),
  parentParcel: one(landParcels, {
    fields: [landParcels.parentParcelId],
    references: [landParcels.id],
    relationName: 'parcelHierarchy',
  }),
  childParcels: many(landParcels, { relationName: 'parcelHierarchy' }),
  portions: many(parcelPortions),
}));

export const parcelPortionsRelations = relations(parcelPortions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [parcelPortions.tenantId],
    references: [tenants.id],
  }),
  parcel: one(landParcels, {
    fields: [parcelPortions.parcelId],
    references: [landParcels.id],
  }),
  lease: one(leases, {
    fields: [parcelPortions.leaseId],
    references: [leases.id],
  }),
  customer: one(customers, {
    fields: [parcelPortions.customerId],
    references: [customers.id],
  }),
}));
