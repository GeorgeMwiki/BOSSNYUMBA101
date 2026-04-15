/**
 * Jurisdiction Configuration Schema
 *
 * Database-driven jurisdiction configs that make BOSSNYUMBA a global
 * SaaS platform. Adding a new country = inserting a row here.
 * No code changes required.
 *
 * The admin portal can CRUD these rows. The services read from this
 * table at boot and cache in-memory (via the jurisdiction registry
 * in packages/domain-models/src/jurisdiction/).
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
  real,
} from 'drizzle-orm/pg-core';

export const jurisdictionConfigs = pgTable(
  'jurisdiction_configs',
  {
    /** ISO-3166 alpha-2 country code (primary key) */
    countryCode: text('country_code').primaryKey(),
    /** Human-readable country name */
    countryName: text('country_name').notNull(),
    /** ISO-4217 default currency */
    defaultCurrency: text('default_currency').notNull().default('USD'),
    /** Available languages (ISO-639-1 codes) */
    languages: jsonb('languages').$type<string[]>().notNull().default(['en']),
    /** Default language for new users */
    defaultLanguage: text('default_language').notNull().default('en'),
    /** IANA timezone */
    timezone: text('timezone').notNull().default('UTC'),
    /** Phone country code */
    phonePrefix: text('phone_prefix').notNull().default('+1'),

    // Tax rates (jsonb array of TaxRateConfig objects)
    taxRates: jsonb('tax_rates').$type<Array<{
      key: string;
      label: string;
      rate: number;
      appliesToResidential: boolean;
      appliesToCommercial: boolean;
      overridable: boolean;
      notes?: string;
      effectiveFrom?: string;
      effectiveTo?: string;
    }>>().notNull().default([]),

    // Fiscal authority (jsonb object, nullable)
    fiscalAuthority: jsonb('fiscal_authority').$type<{
      key: string;
      name: string;
      apiBaseUrl: string;
      authMethod: string;
      requiresPreAuthSubmission: boolean;
      triggeringInvoiceTypes: string[];
      envPrefix: string;
      active: boolean;
    } | null>().default(null),

    // Compliance (jsonb object)
    compliance: jsonb('compliance').$type<{
      dataProtectionLaw: string;
      requiresExplicitCookieConsent: boolean;
      blockedSubprocessors: string[];
      dataResidency: string;
      maxRetentionDays: number;
      requiresDpo: boolean;
      crossBorderTransferRequiresConsent: boolean;
    }>().notNull(),

    // Template + doc identifiers
    invoiceTemplateId: text('invoice_template_id').notNull().default('global-default'),
    privacyDocId: text('privacy_doc_id').notNull().default('global-privacy'),
    termsDocId: text('terms_doc_id').notNull().default('global-tos'),

    // AI/ML overrides (continuously learned)
    aiOverrides: jsonb('ai_overrides').$type<Record<string, unknown>>().default({}),

    // Status
    active: boolean('active').notNull().default(true),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activeIdx: index('jc_active_idx').on(table.active),
    currencyIdx: index('jc_currency_idx').on(table.defaultCurrency),
  })
);

export type JurisdictionConfigRow = typeof jurisdictionConfigs.$inferSelect;
export type NewJurisdictionConfigRow = typeof jurisdictionConfigs.$inferInsert;
