/**
 * Utilities Schemas
 * Utility accounts, readings, and bills
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  decimal,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { properties, units } from './property.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const utilityTypeEnum = pgEnum('utility_type', [
  'water',
  'electricity',
  'gas',
  'internet',
  'trash',
  'other',
]);

export const utilityAccountStatusEnum = pgEnum('utility_account_status', [
  'active',
  'inactive',
  'suspended',
  'closed',
]);

export const billStatusEnum = pgEnum('utility_bill_status', [
  'pending',
  'paid',
  'overdue',
  'cancelled',
]);

// ============================================================================
// Utility Accounts Table
// ============================================================================

export const utilityAccounts = pgTable(
  'utility_accounts',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').references(() => properties.id, { onDelete: 'cascade' }),
    unitId: text('unit_id').references(() => units.id, { onDelete: 'cascade' }),
    accountNumber: text('account_number').notNull(),
    provider: text('provider').notNull(),
    utilityType: utilityTypeEnum('utility_type').notNull(),
    meterNumber: text('meter_number'),
    status: utilityAccountStatusEnum('status').notNull().default('active'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('utility_accounts_tenant_idx').on(table.tenantId),
    propertyIdx: index('utility_accounts_property_idx').on(table.propertyId),
    unitIdx: index('utility_accounts_unit_idx').on(table.unitId),
    accountNumberIdx: index('utility_accounts_account_number_idx').on(table.accountNumber),
    statusIdx: index('utility_accounts_status_idx').on(table.status),
  })
);

// ============================================================================
// Utility Readings Table
// ============================================================================

export const utilityReadings = pgTable(
  'utility_readings',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => utilityAccounts.id, { onDelete: 'cascade' }),
    readingValue: decimal('reading_value', { precision: 15, scale: 4 }).notNull(),
    previousReading: decimal('previous_reading', { precision: 15, scale: 4 }),
    unit: text('unit').notNull().default('kWh'),
    readingDate: timestamp('reading_date', { withTimezone: true }).notNull(),
    notes: text('notes'),
    submittedBy: text('submitted_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
  },
  (table) => ({
    accountIdx: index('utility_readings_account_idx').on(table.accountId),
    readingDateIdx: index('utility_readings_reading_date_idx').on(table.readingDate),
  })
);

// ============================================================================
// Utility Bills Table
// ============================================================================

export const utilityBills = pgTable(
  'utility_bills',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => utilityAccounts.id, { onDelete: 'cascade' }),
    readingId: text('reading_id').references(() => utilityReadings.id, { onDelete: 'set null' }),
    billNumber: text('bill_number').notNull(),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('KES'),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    status: billStatusEnum('status').notNull().default('pending'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    accountIdx: index('utility_bills_account_idx').on(table.accountId),
    statusIdx: index('utility_bills_status_idx').on(table.status),
    periodIdx: index('utility_bills_period_idx').on(table.periodStart, table.periodEnd),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const utilityAccountsRelations = relations(utilityAccounts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [utilityAccounts.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [utilityAccounts.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [utilityAccounts.unitId],
    references: [units.id],
  }),
  readings: many(utilityReadings),
  bills: many(utilityBills),
}));

export const utilityReadingsRelations = relations(utilityReadings, ({ one }) => ({
  account: one(utilityAccounts, {
    fields: [utilityReadings.accountId],
    references: [utilityAccounts.id],
  }),
}));

export const utilityBillsRelations = relations(utilityBills, ({ one }) => ({
  account: one(utilityAccounts, {
    fields: [utilityBills.accountId],
    references: [utilityAccounts.id],
  }),
  reading: one(utilityReadings, {
    fields: [utilityBills.readingId],
    references: [utilityReadings.id],
  }),
}));

/** Alias for utility_readings table (used as meter_readings in spec) */
export const meterReadings = utilityReadings;
