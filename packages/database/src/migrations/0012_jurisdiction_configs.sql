-- BOSSNYUMBA Jurisdiction Configuration Migration
-- Creates jurisdiction_configs table and seeds initial rows for
-- Tanzania (TZ), Kenya (KE), Nigeria (NG), and South Africa (ZA).
--
-- Mirrors packages/database/src/schemas/jurisdiction-config.schema.ts

-- ============================================================================
-- Table: jurisdiction_configs
-- ============================================================================

CREATE TABLE IF NOT EXISTS jurisdiction_configs (
  country_code          TEXT PRIMARY KEY,
  country_name          TEXT NOT NULL,
  default_currency      TEXT NOT NULL DEFAULT 'USD',
  languages             JSONB NOT NULL DEFAULT '["en"]'::jsonb,
  default_language      TEXT NOT NULL DEFAULT 'en',
  timezone              TEXT NOT NULL DEFAULT 'UTC',
  phone_prefix          TEXT NOT NULL DEFAULT '+1',

  tax_rates             JSONB NOT NULL DEFAULT '[]'::jsonb,
  fiscal_authority      JSONB DEFAULT NULL,
  compliance            JSONB NOT NULL,

  invoice_template_id   TEXT NOT NULL DEFAULT 'global-default',
  privacy_doc_id        TEXT NOT NULL DEFAULT 'global-privacy',
  terms_doc_id          TEXT NOT NULL DEFAULT 'global-tos',

  ai_overrides          JSONB DEFAULT '{}'::jsonb,

  active                BOOLEAN NOT NULL DEFAULT TRUE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS jc_active_idx   ON jurisdiction_configs(active);
CREATE INDEX IF NOT EXISTS jc_currency_idx ON jurisdiction_configs(default_currency);

-- ============================================================================
-- Seed: Tanzania (TZ)
-- ============================================================================
INSERT INTO jurisdiction_configs (
  country_code, country_name, default_currency, languages, default_language,
  timezone, phone_prefix, tax_rates, fiscal_authority, compliance,
  invoice_template_id, privacy_doc_id, terms_doc_id, active
) VALUES (
  'TZ', 'Tanzania', 'TZS', '["sw","en"]'::jsonb, 'sw',
  'Africa/Dar_es_Salaam', '+255',
  '[
    {"key":"vat","label":"VAT","rate":0.18,"appliesToResidential":false,"appliesToCommercial":true,"overridable":true,"notes":"Standard VAT (TRA)"},
    {"key":"withholding_rent","label":"Withholding Tax on Rent","rate":0.10,"appliesToResidential":true,"appliesToCommercial":true,"overridable":true}
  ]'::jsonb,
  '{
    "key":"tra_efd","name":"Tanzania Revenue Authority (EFD)","apiBaseUrl":"https://efd.tra.go.tz",
    "authMethod":"oauth2","requiresPreAuthSubmission":true,
    "triggeringInvoiceTypes":["rent","service"],"envPrefix":"TRA_","active":false
  }'::jsonb,
  '{
    "dataProtectionLaw":"Tanzania PDPA 2022","requiresExplicitCookieConsent":true,
    "blockedSubprocessors":[],"dataResidency":"TZ","maxRetentionDays":2555,
    "requiresDpo":true,"crossBorderTransferRequiresConsent":true
  }'::jsonb,
  'tz-default', 'tz-privacy', 'tz-tos', TRUE
)
ON CONFLICT (country_code) DO NOTHING;

-- ============================================================================
-- Seed: Kenya (KE)
-- ============================================================================
INSERT INTO jurisdiction_configs (
  country_code, country_name, default_currency, languages, default_language,
  timezone, phone_prefix, tax_rates, fiscal_authority, compliance,
  invoice_template_id, privacy_doc_id, terms_doc_id, active
) VALUES (
  'KE', 'Kenya', 'KES', '["en","sw"]'::jsonb, 'en',
  'Africa/Nairobi', '+254',
  '[
    {"key":"vat","label":"VAT","rate":0.16,"appliesToResidential":false,"appliesToCommercial":true,"overridable":true,"notes":"Standard VAT (KRA)"},
    {"key":"withholding_rent","label":"Withholding Tax on Rent (Resident)","rate":0.10,"appliesToResidential":true,"appliesToCommercial":true,"overridable":true},
    {"key":"rental_income","label":"Monthly Rental Income Tax","rate":0.075,"appliesToResidential":true,"appliesToCommercial":false,"overridable":true,"notes":"7.5% MRI where annual gross rent <= 15M KES"}
  ]'::jsonb,
  '{
    "key":"kra_etims","name":"Kenya Revenue Authority (eTIMS)","apiBaseUrl":"https://etims.kra.go.ke",
    "authMethod":"oauth2","requiresPreAuthSubmission":true,
    "triggeringInvoiceTypes":["rent","service","deposit"],"envPrefix":"KRA_","active":true
  }'::jsonb,
  '{
    "dataProtectionLaw":"Kenya DPA 2019","requiresExplicitCookieConsent":true,
    "blockedSubprocessors":[],"dataResidency":"KE","maxRetentionDays":2555,
    "requiresDpo":true,"crossBorderTransferRequiresConsent":true
  }'::jsonb,
  'ke-default', 'ke-privacy', 'ke-tos', TRUE
)
ON CONFLICT (country_code) DO NOTHING;

-- ============================================================================
-- Seed: Nigeria (NG)
-- ============================================================================
INSERT INTO jurisdiction_configs (
  country_code, country_name, default_currency, languages, default_language,
  timezone, phone_prefix, tax_rates, fiscal_authority, compliance,
  invoice_template_id, privacy_doc_id, terms_doc_id, active
) VALUES (
  'NG', 'Nigeria', 'NGN', '["en"]'::jsonb, 'en',
  'Africa/Lagos', '+234',
  '[
    {"key":"vat","label":"VAT","rate":0.075,"appliesToResidential":false,"appliesToCommercial":true,"overridable":true,"notes":"FIRS VAT"},
    {"key":"withholding_rent","label":"Withholding Tax on Rent","rate":0.10,"appliesToResidential":true,"appliesToCommercial":true,"overridable":true}
  ]'::jsonb,
  '{
    "key":"firs","name":"Federal Inland Revenue Service","apiBaseUrl":"https://einvoice.firs.gov.ng",
    "authMethod":"oauth2","requiresPreAuthSubmission":false,
    "triggeringInvoiceTypes":["service"],"envPrefix":"FIRS_","active":false
  }'::jsonb,
  '{
    "dataProtectionLaw":"NDPA 2023","requiresExplicitCookieConsent":true,
    "blockedSubprocessors":[],"dataResidency":"NG","maxRetentionDays":2555,
    "requiresDpo":true,"crossBorderTransferRequiresConsent":true
  }'::jsonb,
  'ng-default', 'ng-privacy', 'ng-tos', TRUE
)
ON CONFLICT (country_code) DO NOTHING;

-- ============================================================================
-- Seed: South Africa (ZA)
-- ============================================================================
INSERT INTO jurisdiction_configs (
  country_code, country_name, default_currency, languages, default_language,
  timezone, phone_prefix, tax_rates, fiscal_authority, compliance,
  invoice_template_id, privacy_doc_id, terms_doc_id, active
) VALUES (
  'ZA', 'South Africa', 'ZAR', '["en","af","zu"]'::jsonb, 'en',
  'Africa/Johannesburg', '+27',
  '[
    {"key":"vat","label":"VAT","rate":0.15,"appliesToResidential":false,"appliesToCommercial":true,"overridable":true,"notes":"SARS VAT"}
  ]'::jsonb,
  '{
    "key":"sars","name":"South African Revenue Service","apiBaseUrl":"https://secure.sarsefiling.co.za",
    "authMethod":"oauth2","requiresPreAuthSubmission":false,
    "triggeringInvoiceTypes":["service"],"envPrefix":"SARS_","active":false
  }'::jsonb,
  '{
    "dataProtectionLaw":"POPIA","requiresExplicitCookieConsent":true,
    "blockedSubprocessors":[],"dataResidency":"ZA","maxRetentionDays":2555,
    "requiresDpo":true,"crossBorderTransferRequiresConsent":true
  }'::jsonb,
  'za-default', 'za-privacy', 'za-tos', TRUE
)
ON CONFLICT (country_code) DO NOTHING;

-- ============================================================================
-- Down (reference)
-- ============================================================================
-- DELETE FROM jurisdiction_configs WHERE country_code IN ('TZ','KE','NG','ZA');
-- DROP TABLE IF EXISTS jurisdiction_configs;
