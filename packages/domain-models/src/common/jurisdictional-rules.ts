/**
 * Per-country jurisdictional rules — the single source of truth for every
 * place the platform needs to vary behaviour by country (currency, locale,
 * phone format, tax authority + VAT rate, ID document, payment rails,
 * lease law, data-protection statute).
 *
 * Why a separate module from `region-config.ts`?
 *   `region-config.ts` is the *legacy* RegionConfig shape (founder-era
 *   East-African defaults + a Zod schema for phone/taxpayer-id). It is
 *   battle-tested and woven into the rest of the platform.
 *
 *   This module is the *new* contract for adding a jurisdiction WITHOUT
 *   touching any code path: every business rule that used to be hard-
 *   coded behind `if (country === 'TZ')` can read its parameter from
 *   `getJurisdictionalRules(country)`. Adding a country is now a single-
 *   object edit.
 *
 *   The two modules overlap intentionally — `region-config.ts` will be
 *   migrated to read from this table in Phase E. For now they coexist
 *   and the values are kept consistent.
 *
 * Sources (May 2026):
 *   TZ — TRA, NIDA, eArdhi, M-Pesa Tanzania (Vodacom), Airtel Money,
 *        Halotel Pesa, GePG; VAT 18 %; PDPA 2022 (PDPC); monthly MRI.
 *   KE — KRA, Huduma Namba (National ID fallback), Ardhisasa, M-Pesa
 *        Safaricom, Airtel Money, T-Kash, PesaLink; VAT 16 %; DPA 2019
 *        (ODPC); monthly MRI.
 *
 * Add a jurisdiction: append an entry to `RULES_BY_COUNTRY`. That is
 * intentionally the *only* required edit — no `if` branch anywhere else.
 */

import type { CurrencyCode } from './types.js';

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export interface JurisdictionalIdentityDocType {
  readonly code: string;
  readonly displayName: string;
  readonly verifierMcpServer: string;
  readonly numberRegex: RegExp;
}

export interface JurisdictionalTaxAuthority {
  readonly code: string;
  readonly displayName: string;
  readonly portalUrl: string;
  readonly mriFilingFrequency: 'monthly' | 'quarterly' | 'annual';
  readonly vatRatePct: number;
  readonly taxpayerIdRegex: RegExp;
}

export interface JurisdictionalLandRegistry {
  readonly code: string;
  readonly displayName: string;
  readonly mcpServer: string;
}

export interface JurisdictionalMobileMoneyProvider {
  readonly provider: string;
  readonly mcpServer: string;
  readonly nationalReachPct: number;
}

export interface JurisdictionalBankRailProvider {
  readonly code: string;
  readonly displayName: string;
}

export interface JurisdictionalLeaseRules {
  readonly minNoticeDays: {
    readonly quit: number;
    readonly eviction: number;
    readonly rentIncrease: number;
  };
  readonly maxSecurityDepositMonths: number;
  readonly statutoryGracePeriodDays: number;
  readonly habitabilityStandardsRef: string;
}

export interface JurisdictionalDataProtection {
  readonly statuteName: string;
  readonly regulatorName: string;
  readonly breachNotifyHours: number;
  readonly dataLocalizationRequired: boolean;
}

export interface JurisdictionalRules {
  readonly countryCode: string;
  readonly countryName: string;
  readonly defaultCurrency: CurrencyCode;
  readonly defaultLocale: string;
  readonly defaultTimezone: string;
  readonly awsRegionDefault: string;
  readonly e164CountryCode: string;
  readonly phoneRegex: RegExp;
  readonly identityDocType: JurisdictionalIdentityDocType;
  readonly taxAuthority: JurisdictionalTaxAuthority;
  readonly landRegistry: JurisdictionalLandRegistry;
  readonly mobileMoney: ReadonlyArray<JurisdictionalMobileMoneyProvider>;
  readonly bankRailProvider: JurisdictionalBankRailProvider;
  readonly leaseRules: JurisdictionalLeaseRules;
  readonly dataProtection: JurisdictionalDataProtection;
}

// ---------------------------------------------------------------------------
// Tanzania
// ---------------------------------------------------------------------------

const TZ_RULES: JurisdictionalRules = Object.freeze({
  countryCode: 'TZ',
  countryName: 'Tanzania',
  defaultCurrency: 'TZS',
  defaultLocale: 'sw-TZ',
  defaultTimezone: 'Africa/Dar_es_Salaam',
  // eu-west-1 (Ireland) is the closest currently-GA AWS region to East
  // Africa with full service parity; af-south-1 (Cape Town) lacks several
  // services we rely on. Revisit when AWS opens an East-Africa region.
  awsRegionDefault: 'eu-west-1',
  e164CountryCode: '+255',
  // E.164 (+255 7XX XXX XXX | +255 6XX XXX XXX) OR national (07XX/06XX).
  phoneRegex: /^(?:\+255|0)[67]\d{8}$/,
  identityDocType: Object.freeze({
    code: 'NIDA',
    displayName: 'National Identification Authority Number',
    verifierMcpServer: '@bossnyumba/mcp-nida',
    // NIDA NIN: 20 digits.
    numberRegex: /^\d{20}$/,
  }),
  taxAuthority: Object.freeze({
    code: 'TRA',
    displayName: 'Tanzania Revenue Authority',
    portalUrl: 'https://www.tra.go.tz',
    mriFilingFrequency: 'monthly',
    vatRatePct: 18,
    // TRA TIN: 9 digits.
    taxpayerIdRegex: /^\d{9}$/,
  }),
  landRegistry: Object.freeze({
    code: 'EARDHI',
    displayName: 'Wizara ya Ardhi — eArdhi',
    mcpServer: '@bossnyumba/mcp-eardhi',
  }),
  mobileMoney: Object.freeze([
    Object.freeze({
      provider: 'M-Pesa',
      mcpServer: '@bossnyumba/mcp-mpesa-tz',
      nationalReachPct: 45,
    }),
    Object.freeze({
      provider: 'Airtel Money',
      mcpServer: '@bossnyumba/mcp-airtel-money-tz',
      nationalReachPct: 28,
    }),
    Object.freeze({
      provider: 'Halotel Pesa',
      mcpServer: '@bossnyumba/mcp-halotel-pesa',
      nationalReachPct: 7,
    }),
  ]),
  bankRailProvider: Object.freeze({
    code: 'GePG',
    displayName: 'Government Electronic Payment Gateway',
  }),
  leaseRules: Object.freeze({
    minNoticeDays: Object.freeze({
      quit: 90,
      eviction: 90,
      rentIncrease: 30,
    }),
    maxSecurityDepositMonths: 6,
    statutoryGracePeriodDays: 14,
    habitabilityStandardsRef: 'Land Act 1999 (Cap. 113) §83 + Local Government (Urban Authorities) Act §55',
  }),
  dataProtection: Object.freeze({
    statuteName: 'Personal Data Protection Act 2022',
    regulatorName: 'Personal Data Protection Commission (PDPC)',
    breachNotifyHours: 72,
    dataLocalizationRequired: true,
  }),
});

// ---------------------------------------------------------------------------
// Kenya
// ---------------------------------------------------------------------------

const KE_RULES: JurisdictionalRules = Object.freeze({
  countryCode: 'KE',
  countryName: 'Kenya',
  defaultCurrency: 'KES',
  defaultLocale: 'en-KE',
  defaultTimezone: 'Africa/Nairobi',
  // Same rationale as TZ — eu-west-1 is the nearest GA region with full
  // service parity. af-south-1 lacks several services.
  awsRegionDefault: 'eu-west-1',
  e164CountryCode: '+254',
  // E.164 (+254 7XX/1XX XXX XXX) OR national (07XX/01XX).
  phoneRegex: /^(?:\+254|0)[17]\d{8}$/,
  identityDocType: Object.freeze({
    code: 'HUDUMA',
    displayName: 'Huduma Namba (National ID Number)',
    verifierMcpServer: '@bossnyumba/mcp-huduma',
    // Kenyan National ID: 7 or 8 digits (Huduma Namba is a unique 9-digit
    // identifier built on the same base; accept either).
    numberRegex: /^\d{7,9}$/,
  }),
  taxAuthority: Object.freeze({
    code: 'KRA',
    displayName: 'Kenya Revenue Authority',
    portalUrl: 'https://itax.kra.go.ke',
    mriFilingFrequency: 'monthly',
    vatRatePct: 16,
    // KRA PIN: letter + 9 digits + letter, e.g. A123456789B.
    taxpayerIdRegex: /^[A-Z]\d{9}[A-Z]$/,
  }),
  landRegistry: Object.freeze({
    code: 'ARDHISASA',
    displayName: 'Ministry of Lands — Ardhisasa',
    mcpServer: '@bossnyumba/mcp-ardhisasa',
  }),
  mobileMoney: Object.freeze([
    Object.freeze({
      provider: 'M-Pesa',
      mcpServer: '@bossnyumba/mcp-mpesa-ke',
      nationalReachPct: 96,
    }),
    Object.freeze({
      provider: 'Airtel Money',
      mcpServer: '@bossnyumba/mcp-airtel-money-ke',
      nationalReachPct: 3,
    }),
    Object.freeze({
      provider: 'T-Kash',
      mcpServer: '@bossnyumba/mcp-tkash',
      nationalReachPct: 1,
    }),
  ]),
  bankRailProvider: Object.freeze({
    code: 'PESALINK',
    displayName: 'PesaLink (Integrated Payment Services Ltd)',
  }),
  leaseRules: Object.freeze({
    minNoticeDays: Object.freeze({
      quit: 60,
      eviction: 60,
      rentIncrease: 90,
    }),
    maxSecurityDepositMonths: 2,
    statutoryGracePeriodDays: 14,
    habitabilityStandardsRef: 'Landlord and Tenant (Shops, Hotels and Catering Establishments) Act Cap. 301 + Rent Restriction Act Cap. 296',
  }),
  dataProtection: Object.freeze({
    statuteName: 'Data Protection Act 2019',
    regulatorName: 'Office of the Data Protection Commissioner (ODPC)',
    breachNotifyHours: 72,
    dataLocalizationRequired: false,
  }),
});

// ---------------------------------------------------------------------------
// Registry + lookup
// ---------------------------------------------------------------------------

const RULES_BY_COUNTRY: Readonly<Record<string, JurisdictionalRules>> =
  Object.freeze({
    TZ: TZ_RULES,
    KE: KE_RULES,
  });

/**
 * Look up jurisdictional rules for a country.
 *
 * Case-insensitive (`'tz'` → `'TZ'`). Throws a descriptive error pointing
 * to the registry file so adding a jurisdiction has a single discoverable
 * edit site.
 */
export function getJurisdictionalRules(countryCode: string): JurisdictionalRules {
  const upper = countryCode.toUpperCase();
  const rules = RULES_BY_COUNTRY[upper];
  if (!rules) {
    throw new Error(
      `No jurisdictional rules for country '${countryCode}'. Add an entry to packages/domain-models/src/common/jurisdictional-rules.ts.`
    );
  }
  return rules;
}

/**
 * List the ISO 3166-1 alpha-2 codes that have a jurisdictional-rules
 * entry. Returns codes in registry order, frozen.
 */
export function listSupportedJurisdictions(): ReadonlyArray<string> {
  return Object.freeze(Object.keys(RULES_BY_COUNTRY));
}
