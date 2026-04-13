/**
 * Jurisdiction Seed Data
 *
 * Initial configurations for jurisdictions where BOSSNYUMBA operates.
 * In production these live in the `jurisdiction_configs` database table.
 * This file provides the initial seed + acts as a reference for the
 * admin portal's jurisdiction management UI.
 *
 * TO ADD A NEW COUNTRY: copy an existing seed, change the values,
 * and call `registerJurisdiction(newConfig)`. No other code changes
 * required — the tax engine, compliance engine, AI copilot, and
 * invoice pipeline all read from the jurisdiction registry.
 */

import { type JurisdictionConfig, registerJurisdiction } from './jurisdiction.js';

// ---------------------------------------------------------------------------
// Tanzania (launch jurisdiction)
// ---------------------------------------------------------------------------

export const TANZANIA: JurisdictionConfig = {
  countryCode: 'TZ',
  countryName: 'Tanzania',
  defaultCurrency: 'TZS',
  languages: ['sw', 'en'],
  defaultLanguage: 'sw',
  timezone: 'Africa/Dar_es_Salaam',
  phonePrefix: '+255',
  taxRates: [
    {
      key: 'vat',
      label: 'Value Added Tax',
      rate: 0.18,
      appliesToResidential: false,
      appliesToCommercial: true,
      overridable: false,
      notes: 'TZ standard VAT rate. Residential rent is exempt.',
    },
    {
      key: 'wht_resident',
      label: 'Withholding Tax (Resident)',
      rate: 0.10,
      appliesToResidential: true,
      appliesToCommercial: true,
      overridable: false,
      notes: '10% WHT on rent to resident landlords.',
    },
    {
      key: 'wht_nonresident',
      label: 'Withholding Tax (Non-Resident)',
      rate: 0.15,
      appliesToResidential: true,
      appliesToCommercial: true,
      overridable: false,
      notes: '15% WHT on rent to non-resident landlords.',
    },
  ],
  fiscalAuthority: {
    key: 'tra',
    name: 'Tanzania Revenue Authority',
    apiBaseUrl: 'https://api.tra.go.tz',
    authMethod: 'api_key',
    requiresPreAuthSubmission: true,
    triggeringInvoiceTypes: ['RENT', 'UTILITY', 'MAINTENANCE', 'OTHER'],
    envPrefix: 'TRA',
    active: true,
  },
  compliance: {
    dataProtectionLaw: 'Tanzania Personal Data Protection Act, 2022 (PDPA)',
    requiresExplicitCookieConsent: true,
    blockedSubprocessors: ['deepseek'],
    dataResidency: 'in_region',
    maxRetentionDays: 0,
    requiresDpo: true,
    crossBorderTransferRequiresConsent: true,
  },
  invoiceTemplateId: 'tz-tra',
  privacyDocId: 'tz-pdpa',
  termsDocId: 'tz-tos',
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-04-13T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Kenya (second jurisdiction)
// ---------------------------------------------------------------------------

export const KENYA: JurisdictionConfig = {
  countryCode: 'KE',
  countryName: 'Kenya',
  defaultCurrency: 'KES',
  languages: ['en', 'sw'],
  defaultLanguage: 'en',
  timezone: 'Africa/Nairobi',
  phonePrefix: '+254',
  taxRates: [
    {
      key: 'vat',
      label: 'Value Added Tax',
      rate: 0.16,
      appliesToResidential: false,
      appliesToCommercial: true,
      overridable: false,
      notes: 'KE standard VAT rate. Residential rent is exempt.',
    },
    {
      key: 'mri',
      label: 'Monthly Rental Income Tax',
      rate: 0.075,
      appliesToResidential: true,
      appliesToCommercial: true,
      overridable: true,
      notes: 'Post-Jan-2024 rate (was 10% pre-2024). Verify with KRA. Overridable via MRI_RATE_OVERRIDE env.',
      effectiveFrom: '2024-01-01',
    },
    {
      key: 'wht_resident',
      label: 'Withholding Tax (Resident)',
      rate: 0.10,
      appliesToResidential: true,
      appliesToCommercial: true,
      overridable: false,
    },
    {
      key: 'wht_nonresident',
      label: 'Withholding Tax (Non-Resident)',
      rate: 0.30,
      appliesToResidential: true,
      appliesToCommercial: true,
      overridable: false,
    },
  ],
  fiscalAuthority: {
    key: 'kra',
    name: 'Kenya Revenue Authority',
    apiBaseUrl: 'https://etims.kra.go.ke',
    authMethod: 'hmac',
    requiresPreAuthSubmission: true,
    triggeringInvoiceTypes: ['RENT', 'UTILITY', 'MAINTENANCE', 'OTHER'],
    envPrefix: 'KRA_ETIMS',
    active: true,
  },
  compliance: {
    dataProtectionLaw: 'Kenya Data Protection Act, 2019',
    requiresExplicitCookieConsent: true,
    blockedSubprocessors: ['deepseek'],
    dataResidency: 'in_region',
    maxRetentionDays: 0,
    requiresDpo: true,
    crossBorderTransferRequiresConsent: true,
  },
  invoiceTemplateId: 'ke-etims',
  privacyDocId: 'ke-dpa',
  termsDocId: 'ke-tos',
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-04-13T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Nigeria (expansion-ready template)
// ---------------------------------------------------------------------------

export const NIGERIA: JurisdictionConfig = {
  countryCode: 'NG',
  countryName: 'Nigeria',
  defaultCurrency: 'NGN',
  languages: ['en'],
  defaultLanguage: 'en',
  timezone: 'Africa/Lagos',
  phonePrefix: '+234',
  taxRates: [
    {
      key: 'vat',
      label: 'Value Added Tax',
      rate: 0.075,
      appliesToResidential: false,
      appliesToCommercial: true,
      overridable: false,
      notes: 'Nigeria VAT rate. Residential rent is exempt.',
    },
    {
      key: 'wht',
      label: 'Withholding Tax on Rent',
      rate: 0.10,
      appliesToResidential: true,
      appliesToCommercial: true,
      overridable: false,
      notes: '10% WHT on rent. FIRS requires annual filing.',
    },
  ],
  fiscalAuthority: {
    key: 'firs',
    name: 'Federal Inland Revenue Service',
    apiBaseUrl: 'https://api.firs.gov.ng',
    authMethod: 'api_key',
    requiresPreAuthSubmission: false,
    triggeringInvoiceTypes: [],
    envPrefix: 'FIRS',
    active: false, // Not yet integrated — set to true when API is wired
  },
  compliance: {
    dataProtectionLaw: 'Nigeria Data Protection Act, 2023 (NDPA)',
    requiresExplicitCookieConsent: true,
    blockedSubprocessors: ['deepseek'],
    dataResidency: 'in_region',
    maxRetentionDays: 0,
    requiresDpo: true,
    crossBorderTransferRequiresConsent: true,
  },
  invoiceTemplateId: 'ng-default',
  privacyDocId: 'ng-ndpa',
  termsDocId: 'ng-tos',
  active: false, // Expansion-ready, not yet launched
  createdAt: '2026-04-13T00:00:00Z',
  updatedAt: '2026-04-13T00:00:00Z',
};

// ---------------------------------------------------------------------------
// South Africa (expansion-ready template)
// ---------------------------------------------------------------------------

export const SOUTH_AFRICA: JurisdictionConfig = {
  countryCode: 'ZA',
  countryName: 'South Africa',
  defaultCurrency: 'ZAR',
  languages: ['en', 'zu', 'af'],
  defaultLanguage: 'en',
  timezone: 'Africa/Johannesburg',
  phonePrefix: '+27',
  taxRates: [
    {
      key: 'vat',
      label: 'Value Added Tax',
      rate: 0.15,
      appliesToResidential: false,
      appliesToCommercial: true,
      overridable: false,
    },
  ],
  fiscalAuthority: {
    key: 'sars',
    name: 'South African Revenue Service',
    apiBaseUrl: 'https://api.sars.gov.za',
    authMethod: 'certificate',
    requiresPreAuthSubmission: false,
    triggeringInvoiceTypes: [],
    envPrefix: 'SARS',
    active: false,
  },
  compliance: {
    dataProtectionLaw: 'Protection of Personal Information Act, 2013 (POPIA)',
    requiresExplicitCookieConsent: true,
    blockedSubprocessors: [],
    dataResidency: 'any',
    maxRetentionDays: 0,
    requiresDpo: true,
    crossBorderTransferRequiresConsent: false,
  },
  invoiceTemplateId: 'za-default',
  privacyDocId: 'za-popia',
  termsDocId: 'za-tos',
  active: false,
  createdAt: '2026-04-13T00:00:00Z',
  updatedAt: '2026-04-13T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Boot loader
// ---------------------------------------------------------------------------

/**
 * Load all seed jurisdictions into the registry. Call this at service
 * boot BEFORE any jurisdiction lookup. In production, follow this with
 * a DB load that overrides/extends the seeds.
 */
export function loadSeedJurisdictions(): void {
  registerJurisdiction(TANZANIA);
  registerJurisdiction(KENYA);
  registerJurisdiction(NIGERIA);
  registerJurisdiction(SOUTH_AFRICA);
}
