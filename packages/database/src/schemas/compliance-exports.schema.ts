/**
 * Compliance Exports Schema
 *
 * NEW-20: scheduled, regulator-facing exports for:
 *   - TZ_TRA   — Tanzania Revenue Authority (10% WHT + VAT 18%)
 *   - KE_DPA   — Kenya Data Protection Authority audit schema
 *   - KE_KRA   — Kenya Revenue Authority tax schema
 *   - TZ_LAND  — Tanzania Land Act compliance fields
 *
 * Stores a manifest row per export plus a pointer to the generated file in
 * object storage. Permissions + signed-URL download are handled upstream.
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

export const complianceExportTypeEnum = pgEnum('compliance_export_type', [
  'tz_tra',
  'ke_dpa',
  'ke_kra',
  'tz_land_act',
]);

export const complianceExportStatusEnum = pgEnum('compliance_export_status', [
  'scheduled',
  'generating',
  'ready',
  'downloaded',
  'failed',
  'archived',
]);

export const complianceExportFormatEnum = pgEnum(
  'compliance_export_format',
  ['csv', 'json', 'xml', 'pdf'],
);

export const complianceExports = pgTable(
  'compliance_exports',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    exportType: complianceExportTypeEnum('export_type').notNull(),
    format: complianceExportFormatEnum('format').notNull(),
    status: complianceExportStatusEnum('status').notNull().default('scheduled'),

    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),

    scheduledAt: timestamp('scheduled_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    generatedAt: timestamp('generated_at', { withTimezone: true }),
    downloadedAt: timestamp('downloaded_at', { withTimezone: true }),

    // Storage
    storageKey: text('storage_key'),
    fileSizeBytes: integer('file_size_bytes'),
    fileChecksum: text('file_checksum'),

    // Regulator context (tax ID, certificate number, etc.)
    regulatorContext: jsonb('regulator_context').notNull().default({}),

    // Errors + audit
    errorMessage: text('error_message'),
    requestedBy: text('requested_by'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index('compliance_exports_tenant_idx').on(table.tenantId),
    typeIdx: index('compliance_exports_type_idx').on(table.exportType),
    statusIdx: index('compliance_exports_status_idx').on(table.status),
    periodIdx: index('compliance_exports_period_idx').on(
      table.periodStart,
      table.periodEnd,
    ),
  }),
);

export const complianceExportsRelations = relations(
  complianceExports,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [complianceExports.tenantId],
      references: [tenants.id],
    }),
  }),
);
