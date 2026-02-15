/**
 * Blocks Schema
 * Logical grouping of units within a property (e.g., "Block A", "Building 1")
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { properties } from './property.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const blockStatusEnum = pgEnum('block_status', [
  'active',
  'inactive',
  'under_construction',
  'under_renovation',
  'demolished',
]);

// ============================================================================
// Blocks Table
// ============================================================================

export const blocks = pgTable(
  'blocks',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
    
    // Identity
    blockCode: text('block_code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    
    // Status
    status: blockStatusEnum('status').notNull().default('active'),
    
    // Location within property
    floor: integer('floor'),
    wing: text('wing'),
    
    // Capacity
    totalUnits: integer('total_units').notNull().default(0),
    occupiedUnits: integer('occupied_units').notNull().default(0),
    vacantUnits: integer('vacant_units').notNull().default(0),
    
    // Features
    amenities: jsonb('amenities').default([]),
    features: jsonb('features').default({}),
    
    // Utilities
    hasElevator: boolean('has_elevator').notNull().default(false),
    hasParking: boolean('has_parking').notNull().default(false),
    hasSecurity: boolean('has_security').notNull().default(false),
    
    // Manager
    managerId: text('manager_id'),
    
    // Images
    images: jsonb('images').default([]),
    
    // Display order
    sortOrder: integer('sort_order').default(0),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('blocks_tenant_idx').on(table.tenantId),
    propertyIdx: index('blocks_property_idx').on(table.propertyId),
    codePropertyIdx: uniqueIndex('blocks_code_property_idx').on(table.propertyId, table.blockCode),
    statusIdx: index('blocks_status_idx').on(table.status),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const blocksRelations = relations(blocks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [blocks.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [blocks.propertyId],
    references: [properties.id],
  }),
}));
