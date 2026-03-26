/**
 * TRC Organization Profiles Schema
 * Extends the generic organizations table with TRC-specific metadata
 * for Districts, Stations, EMU, and Directorates
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants, organizations, users } from './tenant.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const trcOrgTypeEnum = pgEnum('trc_org_type', [
  'headquarters',
  'district',
  'station',
  'emu',
  'directorate',
]);

export const trcDistrictCodeEnum = pgEnum('trc_district_code', [
  'DAR',  // Dar es Salaam (Dar, Pwani, ~50% Morogoro)
  'DOD',  // Dodoma (~50% Morogoro, Dodoma, Singida, ~50% Tabora)
  'TAB',  // Tabora (Tabora, Rukwa, Kigoma, Shinyanga, Simiyu, Mwanza)
  'TAN',  // Tanga (Northern Pwani, Tanga, Moshi, Arusha, Mara)
]);

export const trcSystemRoleEnum = pgEnum('trc_system_role', [
  'station_master',
  'emu_officer',
  'emu_head',
  'district_manager',
  'director_civil_engineering',
  'director_general',
]);

// ============================================================================
// TRC Organization Profiles Table
// ============================================================================

export const trcOrganizationProfiles = pgTable(
  'trc_organization_profiles',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

    // TRC-specific classification
    organizationType: trcOrgTypeEnum('organization_type').notNull(),
    districtCode: trcDistrictCodeEnum('district_code'),

    // Regional coverage
    regionsCovered: jsonb('regions_covered').default([]), // e.g. ["Dar es Salaam", "Pwani", "Morogoro"]

    // Contact information
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),
    physicalAddress: text('physical_address'),

    // Station-specific
    stationMasterId: text('station_master_id').references(() => users.id),

    // District-specific
    headOfDistrictId: text('head_of_district_id').references(() => users.id),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('trc_org_profiles_tenant_idx').on(table.tenantId),
    orgIdTenantIdx: uniqueIndex('trc_org_profiles_org_tenant_idx').on(table.tenantId, table.organizationId),
    typeIdx: index('trc_org_profiles_type_idx').on(table.organizationType),
    districtCodeIdx: index('trc_org_profiles_district_code_idx').on(table.districtCode),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const trcOrganizationProfilesRelations = relations(trcOrganizationProfiles, ({ one }) => ({
  tenant: one(tenants, {
    fields: [trcOrganizationProfiles.tenantId],
    references: [tenants.id],
  }),
  organization: one(organizations, {
    fields: [trcOrganizationProfiles.organizationId],
    references: [organizations.id],
  }),
  stationMaster: one(users, {
    fields: [trcOrganizationProfiles.stationMasterId],
    references: [users.id],
    relationName: 'stationMaster',
  }),
  headOfDistrict: one(users, {
    fields: [trcOrganizationProfiles.headOfDistrictId],
    references: [users.id],
    relationName: 'headOfDistrict',
  }),
}));
