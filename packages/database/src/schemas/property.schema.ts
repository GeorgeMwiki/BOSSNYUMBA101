/**
 * Property and Unit Schemas
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
import { tenants, users } from './tenant.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const propertyTypeEnum = pgEnum('property_type', [
  'apartment_complex',
  'single_family',
  'multi_family',
  'townhouse',
  'commercial',
  'mixed_use',
  'estate',
  'other',
]);

export const propertyStatusEnum = pgEnum('property_status', [
  'draft',
  'active',
  'inactive',
  'under_maintenance',
  'sold',
  'archived',
]);

export const unitTypeEnum = pgEnum('unit_type', [
  'studio',
  'one_bedroom',
  'two_bedroom',
  'three_bedroom',
  'four_plus_bedroom',
  'penthouse',
  'duplex',
  'loft',
  'commercial_retail',
  'commercial_office',
  'warehouse',
  'parking',
  'storage',
  'other',
]);

export const unitStatusEnum = pgEnum('unit_status', [
  'vacant',
  'occupied',
  'reserved',
  'under_maintenance',
  'not_available',
]);

// ============================================================================
// Properties Table
// ============================================================================

export const properties = pgTable(
  'properties',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id').notNull().references(() => users.id),
    
    // Identity
    propertyCode: text('property_code').notNull(),
    name: text('name').notNull(),
    type: propertyTypeEnum('type').notNull(),
    status: propertyStatusEnum('status').notNull().default('draft'),
    description: text('description'),
    
    // Address
    addressLine1: text('address_line1').notNull(),
    addressLine2: text('address_line2'),
    city: text('city').notNull(),
    state: text('state'),
    postalCode: text('postal_code'),
    country: text('country').notNull().default('KE'),
    latitude: decimal('latitude', { precision: 10, scale: 8 }),
    longitude: decimal('longitude', { precision: 11, scale: 8 }),
    
    // Capacity
    totalUnits: integer('total_units').notNull().default(0),
    occupiedUnits: integer('occupied_units').notNull().default(0),
    vacantUnits: integer('vacant_units').notNull().default(0),
    
    // Financials
    defaultCurrency: text('default_currency').notNull().default('KES'),
    
    // Amenities & Features
    amenities: jsonb('amenities').default([]),
    features: jsonb('features').default({}),
    
    // Management
    managerId: text('manager_id').references(() => users.id),
    managementNotes: text('management_notes'),
    
    // Documents
    images: jsonb('images').default([]),
    documents: jsonb('documents').default([]),
    
    // Year built
    yearBuilt: integer('year_built'),
    
    // Timestamps
    acquiredAt: timestamp('acquired_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('properties_tenant_idx').on(table.tenantId),
    codeTenantIdx: uniqueIndex('properties_code_tenant_idx').on(table.tenantId, table.propertyCode),
    ownerIdx: index('properties_owner_idx').on(table.ownerId),
    statusIdx: index('properties_status_idx').on(table.status),
    typeIdx: index('properties_type_idx').on(table.type),
    cityIdx: index('properties_city_idx').on(table.city),
  })
);

// ============================================================================
// Units Table
// ============================================================================

export const units = pgTable(
  'units',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
    blockId: text('block_id'), // Optional - references blocks table (circular dep handled by migration)
    
    // Identity
    unitCode: text('unit_code').notNull(),
    name: text('name').notNull(),
    type: unitTypeEnum('type').notNull(),
    status: unitStatusEnum('status').notNull().default('vacant'),
    description: text('description'),
    
    // Location within property
    floor: integer('floor'),
    building: text('building'),
    wing: text('wing'),
    
    // Size
    squareMeters: decimal('square_meters', { precision: 10, scale: 2 }),
    bedrooms: integer('bedrooms').default(0),
    bathrooms: decimal('bathrooms', { precision: 3, scale: 1 }).default('0'),
    
    // Pricing
    baseRentAmount: integer('base_rent_amount').notNull(), // In minor units (cents)
    baseRentCurrency: text('base_rent_currency').notNull().default('KES'),
    depositAmount: integer('deposit_amount'), // In minor units
    
    // Features
    amenities: jsonb('amenities').default([]),
    features: jsonb('features').default({}),
    furnishing: text('furnishing').default('unfurnished'),
    
    // Utilities
    utilitiesIncluded: jsonb('utilities_included').default([]),
    
    // Images
    images: jsonb('images').default([]),
    floorPlan: text('floor_plan'),
    
    // Current occupancy
    currentLeaseId: text('current_lease_id'),
    currentCustomerId: text('current_customer_id'),
    
    // Inspection
    lastInspectionDate: timestamp('last_inspection_date', { withTimezone: true }),
    nextInspectionDue: timestamp('next_inspection_due', { withTimezone: true }),
    inspectionNotes: text('inspection_notes'),
    
    // Availability
    availableFrom: timestamp('available_from', { withTimezone: true }),
    minimumLeaseTerm: integer('minimum_lease_term'), // In months
    maximumLeaseTerm: integer('maximum_lease_term'), // In months
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('units_tenant_idx').on(table.tenantId),
    propertyIdx: index('units_property_idx').on(table.propertyId),
    codePropIdx: uniqueIndex('units_code_property_idx').on(table.propertyId, table.unitCode),
    statusIdx: index('units_status_idx').on(table.status),
    typeIdx: index('units_type_idx').on(table.type),
    currentLeaseIdx: index('units_current_lease_idx').on(table.currentLeaseId),
    blockIdx: index('units_block_idx').on(table.blockId),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [properties.tenantId],
    references: [tenants.id],
  }),
  owner: one(users, {
    fields: [properties.ownerId],
    references: [users.id],
    relationName: 'propertyOwner',
  }),
  manager: one(users, {
    fields: [properties.managerId],
    references: [users.id],
    relationName: 'propertyManager',
  }),
  units: many(units),
  // blocks relation defined in blocks.schema.ts to avoid circular imports
}));

export const unitsRelations = relations(units, ({ one }) => ({
  tenant: one(tenants, {
    fields: [units.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [units.propertyId],
    references: [properties.id],
  }),
  // block relation defined in blocks.schema.ts to avoid circular imports
}));
