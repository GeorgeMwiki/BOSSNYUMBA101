/**
 * Inspections Extensions (NEW 19)
 *
 * Additive column metadata for the existing `inspections` table. Because
 * Drizzle pgTable objects are frozen once declared, these additions are
 * expressed as:
 *
 *   1) A `kind` enum definition (used by SQL migration below),
 *   2) A structured descriptor list that the migration file references, and
 *   3) A side-table `inspection_extensions` that mirrors the same fields for
 *      consumers who prefer a join over an ALTER (safe additive fallback).
 *
 * The authoritative DB change is expressed in the matching migration SQL
 * file, which ALTERs the existing `inspections` table.
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { inspections } from './inspections.schema.js';

// ============================================================================
// Kind enum — a higher-level classification than `type`.
//  - move_in / move_out / routine / conditional_survey
// ============================================================================

export const inspectionKindEnum = pgEnum('inspection_kind', [
  'move_in',
  'move_out',
  'routine',
  'conditional_survey',
]);

// ============================================================================
// Declarative descriptor of the ALTER columns added to `inspections`.
// The migration SQL reads this list as documentation; runtime code can import
// it to generate forms/validation.
// ============================================================================

export const INSPECTIONS_EXTENSION_COLUMNS = [
  { name: 'kind', type: 'inspection_kind', nullable: true },
  { name: 'joint', type: 'boolean', nullable: false, default: 'false' },
  {
    name: 'self_checkout_allowed',
    type: 'boolean',
    nullable: false,
    default: 'false',
  },
  { name: 'tenant_signature_id', type: 'text', nullable: true },
  { name: 'landlord_signature_id', type: 'text', nullable: true },
] as const;

// ============================================================================
// Side-table fallback: `inspection_extensions`
//  — mirrors the ALTER-added fields and is safe to use in environments where
//    the ALTER hasn't been run yet.
// ============================================================================

export const inspectionExtensions = pgTable(
  'inspection_extensions',
  {
    inspectionId: text('inspection_id')
      .primaryKey()
      .references(() => inspections.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    kind: inspectionKindEnum('kind'),
    joint: boolean('joint').notNull().default(false),
    selfCheckoutAllowed: boolean('self_checkout_allowed')
      .notNull()
      .default(false),
    tenantSignatureId: text('tenant_signature_id'),
    landlordSignatureId: text('landlord_signature_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index('inspection_extensions_tenant_idx').on(table.tenantId),
    kindIdx: index('inspection_extensions_kind_idx').on(table.kind),
  })
);

export const inspectionExtensionsRelations = relations(
  inspectionExtensions,
  ({ one }) => ({
    inspection: one(inspections, {
      fields: [inspectionExtensions.inspectionId],
      references: [inspections.id],
    }),
    tenant: one(tenants, {
      fields: [inspectionExtensions.tenantId],
      references: [tenants.id],
    }),
  })
);
