/**
 * regulator_jurisdictions — tenant-agnostic catalogue of real-estate
 * regulatory authorities per country.
 *
 * Companion to migration 0277. Ported from Borjie 0143 — adapted for
 * the real-estate domain (tenancy tribunals, housing authorities,
 * building safety, property tax, land registry, planning permission,
 * rental protection, HOA/strata, tenant rights, data protection).
 *
 * Tenant-AGNOSTIC by design. Regulators publish the same authority
 * catalogue to every operator.
 *
 * Bilingual sw/en + local language per CLAUDE.md hard rule.
 */

import {
  pgTable,
  text,
  timestamp,
  date,
  jsonb,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const REGULATOR_SETS = [
  'TZ-set',
  'KE-set',
  'UG-set',
  'NG-set',
  'ZA-set',
  'UK-set',
  'US-set',
  'AU-set',
  'generic',
] as const;
export type RegulatorSet = (typeof REGULATOR_SETS)[number];

export const REGULATOR_MANDATES = [
  'tenancy-tribunal',
  'housing-authority',
  'building-safety',
  'property-tax',
  'land-registry',
  'planning-permission',
  'rental-protection',
  'hoa-strata',
  'tenant-rights',
  'data-protection',
  'generic',
] as const;
export type RegulatorMandate = (typeof REGULATOR_MANDATES)[number];

export const regulatorJurisdictions = pgTable(
  'regulator_jurisdictions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    countryCode: text('country_code').notNull(),
    nameEn: text('name_en').notNull(),
    nameLocal: text('name_local'),
    slug: text('slug').notNull(),
    regulatorSet: text('regulator_set').$type<RegulatorSet>().notNull(),
    mandate: text('mandate').$type<RegulatorMandate>().notNull(),
    contactUrl: text('contact_url'),
    dsrEndpoint: text('dsr_endpoint'),
    licenceRenewalEndpoint: text('licence_renewal_endpoint'),
    attributes: jsonb('attributes').notNull().default({}),
    activeFrom: date('active_from'),
    activeUntil: date('active_until'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    setSlugUnq: uniqueIndex('regulator_jurisdictions_set_slug_unq').on(
      t.regulatorSet,
      t.slug,
    ),
    countryIdx: index('regulator_jurisdictions_country_idx').on(t.countryCode),
    setIdx: index('regulator_jurisdictions_set_idx').on(t.regulatorSet),
  }),
);

export type RegulatorJurisdiction = typeof regulatorJurisdictions.$inferSelect;
export type NewRegulatorJurisdiction =
  typeof regulatorJurisdictions.$inferInsert;
