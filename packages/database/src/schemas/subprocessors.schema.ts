/**
 * Subprocessors Schema
 *
 * Tracks third-party subprocessors that process Personal Data on behalf of
 * BOSSNYUMBA customers. This table is the persisted mirror of the typed source
 * of truth at `packages/enterprise-hardening/src/compliance/subprocessors.ts`
 * and the public-facing register at `Docs/SUBPROCESSORS.md`.
 *
 * Used for GDPR (Art. 28/30), Kenya DPA (2019), and Tanzania PDPA (2022)
 * compliance obligations.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ============================================================================
// Enums
// ============================================================================

export const subprocessorDpaStatusEnum = pgEnum('subprocessor_dpa_status', [
  'signed',
  'pending',
  'not_applicable',
]);

// ============================================================================
// Subprocessors Table
// ============================================================================

export const subprocessors = pgTable(
  'subprocessors',
  {
    id: text('id').primaryKey(),

    // Identity
    name: text('name').notNull(),
    purpose: text('purpose').notNull(),

    // Data processed
    dataCategories: jsonb('data_categories').$type<string[]>().notNull().default([]),

    // Location / region of processing
    region: text('region').notNull(),

    // DPA status
    dpaStatus: subprocessorDpaStatusEnum('dpa_status').notNull().default('pending'),

    // Risk / gating
    riskFlag: boolean('risk_flag').notNull().default(false),
    riskNotes: text('risk_notes'),
    disabledForCountries: jsonb('disabled_for_countries')
      .$type<string[]>()
      .notNull()
      .default([]),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: index('subprocessors_name_idx').on(table.name),
    dpaStatusIdx: index('subprocessors_dpa_status_idx').on(table.dpaStatus),
    riskFlagIdx: index('subprocessors_risk_flag_idx').on(table.riskFlag),
  })
);

export type Subprocessor = typeof subprocessors.$inferSelect;
export type NewSubprocessor = typeof subprocessors.$inferInsert;
