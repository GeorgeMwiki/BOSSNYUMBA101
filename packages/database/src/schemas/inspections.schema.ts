/**
 * Inspection Schemas
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
import { users } from './tenant.schema.js';
import { properties, units } from './property.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const inspectionTypeEnum = pgEnum('inspection_type', [
  'move_in',
  'move_out',
  'routine',
  'periodic',
  'preventive',
  'complaint',
  'other',
]);

export const inspectionStatusEnum = pgEnum('inspection_status', [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'deferred',
]);

export const signerTypeEnum = pgEnum('insp_signer_type', [
  'inspector',
  'tenant',
  'landlord',
  'agent',
]);

// ============================================================================
// Inspections Table
// ============================================================================

export const inspections = pgTable(
  'inspections',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
    unitId: text('unit_id').references(() => units.id, { onDelete: 'set null' }),
    inspectorId: text('inspector_id').references(() => users.id, { onDelete: 'set null' }),

    // Classification
    type: inspectionTypeEnum('type').notNull().default('routine'),
    status: inspectionStatusEnum('status').notNull().default('scheduled'),

    // Dates
    scheduledDate: timestamp('scheduled_date', { withTimezone: true }),
    completedDate: timestamp('completed_date', { withTimezone: true }),

    // Notes
    notes: text('notes'),
    summary: text('summary'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('inspections_tenant_idx').on(table.tenantId),
    propertyIdx: index('inspections_property_idx').on(table.propertyId),
    unitIdx: index('inspections_unit_idx').on(table.unitId),
    inspectorIdx: index('inspections_inspector_idx').on(table.inspectorId),
    typeIdx: index('inspections_type_idx').on(table.type),
    statusIdx: index('inspections_status_idx').on(table.status),
    scheduledDateIdx: index('inspections_scheduled_date_idx').on(table.scheduledDate),
    completedDateIdx: index('inspections_completed_date_idx').on(table.completedDate),
  })
);

// ============================================================================
// Inspection Items Table
// ============================================================================

export const inspectionItems = pgTable(
  'inspection_items',
  {
    id: text('id').primaryKey(),
    inspectionId: text('inspection_id').notNull().references(() => inspections.id, { onDelete: 'cascade' }),

    // Item details
    room: text('room').notNull(),
    item: text('item').notNull(),
    condition: text('condition').notNull(),
    notes: text('notes'),
    photos: jsonb('photos').default([]),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    inspectionIdx: index('inspection_items_inspection_idx').on(table.inspectionId),
    roomIdx: index('inspection_items_room_idx').on(table.inspectionId, table.room),
  })
);

// ============================================================================
// Inspection Signatures Table
// ============================================================================

export const inspectionSignatures = pgTable(
  'inspection_signatures',
  {
    id: text('id').primaryKey(),
    inspectionId: text('inspection_id').notNull().references(() => inspections.id, { onDelete: 'cascade' }),

    // Signer info
    signerType: signerTypeEnum('signer_type').notNull(),
    signerName: text('signer_name').notNull(),
    signatureData: text('signature_data').notNull(),

    // Timestamps
    signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
    signedBy: text('signed_by'),
  },
  (table) => ({
    inspectionIdx: index('inspection_signatures_inspection_idx').on(table.inspectionId),
    signerTypeIdx: index('inspection_signatures_signer_type_idx').on(table.signerType),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const inspectionsRelations = relations(inspections, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [inspections.tenantId],
    references: [tenants.id],
    relationName: 'inspectionTenant',
  }),
  property: one(properties, {
    fields: [inspections.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [inspections.unitId],
    references: [units.id],
  }),
  inspector: one(users, {
    fields: [inspections.inspectorId],
    references: [users.id],
  }),
  items: many(inspectionItems),
  signatures: many(inspectionSignatures),
}));

export const inspectionItemsRelations = relations(inspectionItems, ({ one }) => ({
  inspection: one(inspections, {
    fields: [inspectionItems.inspectionId],
    references: [inspections.id],
  }),
}));

export const inspectionSignaturesRelations = relations(inspectionSignatures, ({ one }) => ({
  inspection: one(inspections, {
    fields: [inspectionSignatures.inspectionId],
    references: [inspections.id],
  }),
}));
