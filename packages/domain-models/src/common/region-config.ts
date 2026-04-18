/**
 * Region-adaptive configuration registry.
 *
 * RegionConfig is country/currency/compliance only. It is NOT the location
 * hierarchy. For org-defined geographic trees (districts, regions, wards,
 * estates — with arbitrary depth and org-specific label vocabulary), see
 * `packages/domain-models/src/geo/geo-node.ts`.
 *
 * BOSSNYUMBA is a GLOBAL platform. When a tenant signs up they select
 * their country/region, and everything — currency, phone format, tax
 * rates, compliance rules, timezone, locale — adapts to that selection.
 *
 * NO country is hardcoded anywhere in the codebase. Every country-
 * specific value goes through this registry. To add a new country:
 *   1. Add an entry to REGION_CONFIGS below.
 *   2. That's it. Every downstream system reads from here.
 *
 * The tenant's selected country code (ISO 3166-1 alpha-2) is stored on
 * the tenant record as `tenant.country`. All services resolve the
 * config at runtime via `getRegionConfig(tenant.country)`.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhoneConfig {
  /** International dialing prefix without + (e.g. '255' for Tanzania). */
  readonly dialingCode: string;
  /** Regex the full international number must match after normalization. */
  readonly nationalNumberRegex: RegExp;
  /** Example number shown in UI placeholders. */
  readonly placeholder: string;
}

export interface TaxConfig {
  /** VAT / GST rate as a decimal (e.g. 0.18 for 18%). */
  readonly vatRate: number;
  /** Name of the VAT / GST scheme. */
  readonly vatName: string;
  /** Rental income tax rate (if any). null = not applicable. */
  readonly rentalIncomeTaxRate: number | null;
  /** Name of the rental income tax (e.g. 'MRI' for Kenya). */
  readonly rentalIncomeTaxName: string | null;
  /** Maximum late-fee rate allowed by statute (decimal). null = no cap. */
  readonly maxLateFeeRate: number | null;
}

export interface ComplianceConfig {
  /** Tax authority abbreviation (e.g. 'TRA', 'KRA', 'URA'). */
  readonly taxAuthority: string;
  /** Taxpayer ID label (e.g. 'TIN', 'KRA PIN'). */
  readonly taxpayerIdLabel: string;
  /** Regex for taxpayer ID validation (null = free text). */
  readonly taxpayerIdRegex: RegExp | null;
  /** Business registration number label. null = not required. */
  readonly businessRegLabel: string | null;
  /** Eviction notice period (residential) in days. */
  readonly evictionNoticeDaysResidential: number;
  /** Eviction notice period (commercial) in days. */
  readonly evictionNoticeDaysCommercial: number;
  /** Security deposit return deadline in days after lease end. */
  readonly depositReturnDays: number;
}

export interface MobileMoneyProvider {
  readonly id: string;
  readonly name: string;
  /** Env-var prefix for this provider's config (e.g. 'MPESA', 'TIGOPESA'). */
  readonly envPrefix: string;
}

export interface RegionConfig {
  /** ISO 3166-1 alpha-2 country code. */
  readonly countryCode: string;
  /** Human-readable country name. */
  readonly countryName: string;
  /** ISO 4217 currency code. */
  readonly currencyCode: string;
  /** Currency symbol for display. */
  readonly currencySymbol: string;
  /** Number of minor units (cents). 2 for most, 0 for JPY, etc. */
  readonly currencyMinorUnits: number;
  /** IANA timezone (default for the country). */
  readonly defaultTimezone: string;
  /** BCP-47 locale tag (e.g. 'sw-TZ', 'en-KE'). */
  readonly defaultLocale: string;
  /** Phone configuration. */
  readonly phone: PhoneConfig;
  /** Tax configuration. */
  readonly tax: TaxConfig;
  /** Compliance / regulatory configuration. */
  readonly compliance: ComplianceConfig;
  /** Available mobile-money providers. */
  readonly mobileMoneyProviders: readonly MobileMoneyProvider[];
}

// ---------------------------------------------------------------------------
// Registry — add new countries here
// ---------------------------------------------------------------------------

const REGION_CONFIGS: Record<string, RegionConfig> = {
  TZ: {
    countryCode: 'TZ',
    countryName: 'Tanzania',
    currencyCode: 'TZS',
    currencySymbol: 'TSh',
    currencyMinorUnits: 2,
    defaultTimezone: 'Africa/Dar_es_Salaam',
    defaultLocale: 'sw-TZ',
    phone: {
      dialingCode: '255',
      nationalNumberRegex: /^255[67]\d{8}$/,
      placeholder: '+255 7XX XXX XXX',
    },
    tax: {
      vatRate: 0.18,
      vatName: 'VAT',
      rentalIncomeTaxRate: null,
      rentalIncomeTaxName: null,
      maxLateFeeRate: null,
    },
    compliance: {
      taxAuthority: 'TRA',
      taxpayerIdLabel: 'TIN',
      taxpayerIdRegex: /^\d{9}$/,
      businessRegLabel: 'BRELA Registration Number',
      evictionNoticeDaysResidential: 90,
      evictionNoticeDaysCommercial: 90,
      depositReturnDays: 30,
    },
    mobileMoneyProviders: [
      { id: 'mpesa_tz', name: 'M-Pesa (Vodacom)', envPrefix: 'MPESA' },
      { id: 'tigopesa', name: 'Tigo Pesa', envPrefix: 'TIGOPESA' },
      { id: 'airtelmoney', name: 'Airtel Money', envPrefix: 'AIRTELMONEY' },
      { id: 'halopesa', name: 'Halopesa', envPrefix: 'HALOPESA' },
    ],
  },
  KE: {
    countryCode: 'KE',
    countryName: 'Kenya',
    currencyCode: 'KES',
    currencySymbol: 'KSh',
    currencyMinorUnits: 2,
    defaultTimezone: 'Africa/Nairobi',
    defaultLocale: 'en-KE',
    phone: {
      dialingCode: '254',
      nationalNumberRegex: /^254[17]\d{8}$/,
      placeholder: '+254 7XX XXX XXX',
    },
    tax: {
      vatRate: 0.16,
      vatName: 'VAT',
      rentalIncomeTaxRate: 0.075,
      rentalIncomeTaxName: 'MRI',
      maxLateFeeRate: 0.10,
    },
    compliance: {
      taxAuthority: 'KRA',
      taxpayerIdLabel: 'KRA PIN',
      taxpayerIdRegex: /^[A-Z]\d{9}[A-Z]$/,
      businessRegLabel: 'Business Registration Number',
      evictionNoticeDaysResidential: 60,
      evictionNoticeDaysCommercial: 90,
      depositReturnDays: 14,
    },
    mobileMoneyProviders: [
      { id: 'mpesa_ke', name: 'M-Pesa (Safaricom)', envPrefix: 'MPESA' },
    ],
  },
  UG: {
    countryCode: 'UG',
    countryName: 'Uganda',
    currencyCode: 'UGX',
    currencySymbol: 'USh',
    currencyMinorUnits: 0,
    defaultTimezone: 'Africa/Kampala',
    defaultLocale: 'en-UG',
    phone: {
      dialingCode: '256',
      nationalNumberRegex: /^256[37]\d{8}$/,
      placeholder: '+256 7XX XXX XXX',
    },
    tax: {
      vatRate: 0.18,
      vatName: 'VAT',
      rentalIncomeTaxRate: 0.20,
      rentalIncomeTaxName: 'Rental Income Tax',
      maxLateFeeRate: null,
    },
    compliance: {
      taxAuthority: 'URA',
      taxpayerIdLabel: 'TIN',
      taxpayerIdRegex: /^\d{10}$/,
      businessRegLabel: 'URSB Registration Number',
      evictionNoticeDaysResidential: 60,
      evictionNoticeDaysCommercial: 90,
      depositReturnDays: 30,
    },
    mobileMoneyProviders: [
      { id: 'mtn_momo', name: 'MTN Mobile Money', envPrefix: 'MTN_MOMO' },
      { id: 'airtel_ug', name: 'Airtel Money', envPrefix: 'AIRTELMONEY' },
    ],
  },
  RW: {
    countryCode: 'RW',
    countryName: 'Rwanda',
    currencyCode: 'RWF',
    currencySymbol: 'FRw',
    currencyMinorUnits: 0,
    defaultTimezone: 'Africa/Kigali',
    defaultLocale: 'en-RW',
    phone: {
      dialingCode: '250',
      nationalNumberRegex: /^250[78]\d{8}$/,
      placeholder: '+250 7XX XXX XXX',
    },
    tax: {
      vatRate: 0.18,
      vatName: 'VAT',
      rentalIncomeTaxRate: 0.15,
      rentalIncomeTaxName: 'Rental Income Tax',
      maxLateFeeRate: null,
    },
    compliance: {
      taxAuthority: 'RRA',
      taxpayerIdLabel: 'TIN',
      taxpayerIdRegex: /^\d{9}$/,
      businessRegLabel: 'RDB Registration Number',
      evictionNoticeDaysResidential: 30,
      evictionNoticeDaysCommercial: 60,
      depositReturnDays: 30,
    },
    mobileMoneyProviders: [
      { id: 'mtn_rw', name: 'MTN Mobile Money', envPrefix: 'MTN_MOMO' },
      { id: 'airtel_rw', name: 'Airtel Money', envPrefix: 'AIRTELMONEY' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Fallback for countries we don't have a specific config for yet.
// Uses generic sensible defaults. A tenant from an unconfigured country
// still gets a working experience — just without region-specific tweaks.
// ---------------------------------------------------------------------------

// Fallback for when tenant.country has not been set yet (the onboarding
// flow detects the user's location and sets it). The default is
// intentionally GENERIC (USD / UTC) — it exists only as a safe fallback
// so code paths never crash on a missing config. The real region is
// resolved from the user's browser location or IP geolocation during
// signup and persisted as tenant.country.
const GENERIC_CONFIG: RegionConfig = {
  countryCode: '',
  countryName: 'Unknown',
  currencyCode: 'USD',
  currencySymbol: '$',
  currencyMinorUnits: 2,
  defaultTimezone: 'UTC',
  defaultLocale: 'en',
  phone: {
    dialingCode: '',
    nationalNumberRegex: /^[1-9]\d{6,14}$/,
    placeholder: '+X XXX XXX XXXX',
  },
  tax: {
    vatRate: 0,
    vatName: 'Tax',
    rentalIncomeTaxRate: null,
    rentalIncomeTaxName: null,
    maxLateFeeRate: null,
  },
  compliance: {
    taxAuthority: '',
    taxpayerIdLabel: 'Tax ID',
    taxpayerIdRegex: null,
    businessRegLabel: null,
    evictionNoticeDaysResidential: 30,
    evictionNoticeDaysCommercial: 60,
    depositReturnDays: 30,
  },
  mobileMoneyProviders: [],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the full region config for a given ISO 3166-1 alpha-2 country
 * code. Falls back to GENERIC_CONFIG for unrecognized countries so
 * callers never need null-checks.
 */
export function getRegionConfig(countryCode: string | null | undefined): RegionConfig {
  if (!countryCode) return GENERIC_CONFIG;
  const upper = countryCode.trim().toUpperCase();
  return REGION_CONFIGS[upper] ?? { ...GENERIC_CONFIG, countryCode: upper };
}

/** List all countries that have explicit region configs. */
export function getSupportedCountries(): readonly RegionConfig[] {
  return Object.values(REGION_CONFIGS);
}

/** Check if a country code has a dedicated config (vs fallback). */
export function isCountrySupported(countryCode: string): boolean {
  return countryCode.trim().toUpperCase() in REGION_CONFIGS;
}

/**
 * Normalize a phone number for a given country's dialing code.
 * Strips non-digits, converts leading 0 to the country prefix, and
 * prepends the prefix if missing. Works for ANY country — no
 * hardcoded assumptions about Kenya or Tanzania.
 */
export function normalizePhoneForCountry(
  phone: string,
  countryCode: string
): string {
  const cfg = getRegionConfig(countryCode);
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = cfg.phone.dialingCode + cleaned.substring(1);
  }
  if (cfg.phone.dialingCode && !cleaned.startsWith(cfg.phone.dialingCode)) {
    cleaned = cfg.phone.dialingCode + cleaned;
  }
  return cleaned;
}

/**
 * Get the default currency code for a tenant's country. This is what
 * schemas should use instead of `default('KES')` — they should call
 * this with the tenant's country at creation time.
 */
export function getDefaultCurrency(countryCode: string | null | undefined): string {
  return getRegionConfig(countryCode).currencyCode;
}

// ---------------------------------------------------------------------------
// Zod schema for taxpayer ID validation — adapts per country
// ---------------------------------------------------------------------------

export function buildTaxpayerIdSchema(countryCode: string) {
  const cfg = getRegionConfig(countryCode);
  const base = z.string().trim().min(1, `${cfg.compliance.taxpayerIdLabel} is required`);
  if (cfg.compliance.taxpayerIdRegex) {
    return base.transform((v) => v.toUpperCase()).refine(
      (v) => cfg.compliance.taxpayerIdRegex!.test(v),
      { message: `Invalid ${cfg.compliance.taxpayerIdLabel} format` }
    );
  }
  return base;
}
