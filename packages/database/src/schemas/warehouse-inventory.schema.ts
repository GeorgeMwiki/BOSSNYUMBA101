/**
 * Warehouse Inventory Schema — Wave 8 (S7 gap closure)
 *
 * Complements asset-components (installed inventory) with stock / in-transit /
 * broken / decommissioned items. Movements are append-only.
 *
 * Tables:
 *   - warehouse_items       — current stock per SKU
 *   - warehouse_movements   — append-only ledger of every stock change
 */

import { pgTable, text, integer, bigint, jsonb, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';

export const warehouseItems = pgTable(
  'warehouse_items',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    description: text('description'),
    unitOfMeasure: text('unit_of_measure').notNull().default('each'),
    quantity: integer('quantity').notNull().default(0),
    condition: text('condition').notNull().default('new'),
    warehouseLocation: text('warehouse_location'),
    costMinorUnits: bigint('cost_minor_units', { mode: 'number' }),
    currency: text('currency'),
    supplierName: text('supplier_name'),
    purchaseOrderRef: text('purchase_order_ref'),
    notes: text('notes'),
    metadata: jsonb('metadata').notNull().default({}),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    uniqueTenantSku: unique().on(table.tenantId, table.sku),
    tenantIdx: index('idx_warehouse_items_tenant').on(table.tenantId),
    categoryIdx: index('idx_warehouse_items_category').on(table.tenantId, table.category),
  })
);

export const warehouseMovements = pgTable(
  'warehouse_movements',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    warehouseItemId: text('warehouse_item_id').notNull().references(() => warehouseItems.id, { onDelete: 'cascade' }),
    movementType: text('movement_type').notNull(),
    quantityDelta: integer('quantity_delta').notNull(),
    conditionFrom: text('condition_from'),
    conditionTo: text('condition_to'),
    destination: text('destination'),
    relatedCaseId: text('related_case_id'),
    relatedUnitId: text('related_unit_id'),
    reason: text('reason'),
    performedBy: text('performed_by').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('idx_warehouse_movements_tenant').on(table.tenantId),
    itemTimeIdx: index('idx_warehouse_movements_item').on(table.warehouseItemId, table.occurredAt),
    typeIdx: index('idx_warehouse_movements_type').on(table.tenantId, table.movementType),
  })
);

export const warehouseItemsRelations = relations(warehouseItems, ({ many }) => ({
  movements: many(warehouseMovements),
}));

export const warehouseMovementsRelations = relations(warehouseMovements, ({ one }) => ({
  item: one(warehouseItems, {
    fields: [warehouseMovements.warehouseItemId],
    references: [warehouseItems.id],
  }),
}));
