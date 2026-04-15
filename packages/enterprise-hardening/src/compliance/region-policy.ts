/**
 * Region Policy Bundle — DEPRECATED SHIM
 *
 * @deprecated use packages/domain-models/src/jurisdiction/ directly.
 *
 * This file is now a backward-compatibility SHIM. The single source of
 * truth for region/jurisdiction rules is the config-driven jurisdiction
 * registry in `packages/domain-models/src/jurisdiction/`:
 *
 *   - `getJurisdiction(countryCode)` — full JurisdictionConfig
 *   - `getTaxRate(countryCode, key)` — single tax rate
 *   - `isSubprocessorBlocked(countryCode, subprocessorId)`
 *   - `requiresFiscalSubmission(countryCode, invoiceType)`
 *   - `registerJurisdiction(config)` — extend at runtime
 *
 * Adding a new country = inserting a row in the `jurisdiction_configs`
 * table (or calling `registerJurisdiction` with a seed). NO code changes
 * required. The old `Region` enum (TZ / KE / OTHER) is intentionally
 * limited and will be removed once all callers have migrated.
 *
 * DELEGATION MAP (legacy API → jurisdiction registry):
 *
 *   getUserPolicy(region)
 *     → getJurisdiction(regionToCountryCode(region))
 *       Fields are projected from JurisdictionConfig.compliance + .languages.
 *
 *   getOrgFiscalPolicy(region)
 *     → getJurisdiction(regionToCountryCode(region))
 *       Tax rates are projected from JurisdictionConfig.taxRates by key:
 *         vat               → taxRate('vat')
 *         whtRentResident   → taxRate('wht_resident')
 *         whtRentNonResident→ taxRate('wht_nonresident')
 *         mri               → taxRate('mri') or null when absent
 *
 *   isSubprocessorBlockedForRegion(id, region)
 *     → isSubprocessorBlocked(regionToCountryCode(region), id)
 *
 *   requiresFiscalSubmission(region)
 *     → getJurisdiction(...).fiscalAuthority?.requiresPreAuthSubmission
 *
 *   Region.TANZANIA  → countryCode 'TZ'
 *   Region.KENYA     → countryCode 'KE'
 *   Region.OTHER     → countryCode 'GLOBAL' (falls through to GLOBAL_DEFAULT)
 */

import {
  Region,
  Language,
  FiscalAuthority,
} from '@bossnyumba/domain-models';
import {
  getJurisdiction,
  isSubprocessorBlocked as registryIsSubprocessorBlocked,
  loadSeedJurisdictions,
  isJurisdictionConfigured,
  type JurisdictionConfig,
} from '@bossnyumba/domain-models';

// ---------------------------------------------------------------------------
// Lazy seed loader — guarantees the registry is populated before the shim
// projects values out of it. Idempotent.
// ---------------------------------------------------------------------------

let seeded = false;
function ensureSeeded(): void {
  if (seeded) return;
  // Only seed if no jurisdictions are registered yet — avoids clobbering
  // a runtime-loaded DB hydration that already happened.
  if (!isJurisdictionConfigured('TZ')) {
    loadSeedJurisdictions();
  }
  seeded = true;
}

/**
 * Map the legacy Region enum to an ISO-3166 alpha-2 country code that
 * the jurisdiction registry understands. `OTHER` and unknown values
 * resolve to `'GLOBAL'`, which the registry maps to its global default.
 */
function regionToCountryCode(region: Region | undefined | null): string {
  if (!region) return 'GLOBAL';
  if (region === Region.TANZANIA) return 'TZ';
  if (region === Region.KENYA) return 'KE';
  return 'GLOBAL';
}

/**
 * Project a JurisdictionConfig back to the legacy Region enum value.
 * Used to populate the `region`/`fiscalCountry` field on the legacy
 * shim payload. Anything outside TZ/KE collapses to OTHER.
 */
function countryCodeToRegion(countryCode: string): Region {
  const c = countryCode.trim().toUpperCase();
  if (c === 'TZ') return Region.TANZANIA;
  if (c === 'KE') return Region.KENYA;
  return Region.OTHER;
}

function languageFromCode(code: string): Language {
  return code === 'sw' ? Language.SWAHILI : Language.ENGLISH;
}

// ---------------------------------------------------------------------------
// User region policy (PII / privacy / language) — projected from registry
// ---------------------------------------------------------------------------

/** @deprecated use JurisdictionConfig.compliance + .languages directly. */
export interface UserRegionPolicy {
  readonly region: Region;
  readonly defaultLanguage: Language;
  readonly availableLanguages: readonly Language[];
  readonly privacyDocId: string;
  readonly termsDocId: string;
  readonly blockedSubprocessors: readonly string[];
  readonly requiresExplicitCookieConsent: boolean;
  readonly dataProtectionLaw: string;
}

function projectUserPolicy(config: JurisdictionConfig): UserRegionPolicy {
  return {
    region: countryCodeToRegion(config.countryCode),
    defaultLanguage: languageFromCode(config.defaultLanguage),
    availableLanguages: config.languages.map(languageFromCode),
    privacyDocId: config.privacyDocId,
    termsDocId: config.termsDocId,
    blockedSubprocessors: config.compliance.blockedSubprocessors,
    requiresExplicitCookieConsent: config.compliance.requiresExplicitCookieConsent,
    dataProtectionLaw: config.compliance.dataProtectionLaw,
  };
}

/**
 * @deprecated use `getJurisdiction(countryCode)` from
 * `@bossnyumba/domain-models` directly.
 */
export function getUserPolicy(region: Region | undefined | null): UserRegionPolicy {
  ensureSeeded();
  return projectUserPolicy(getJurisdiction(regionToCountryCode(region)));
}

/**
 * @deprecated use `isSubprocessorBlocked(countryCode, id)` from
 * `@bossnyumba/domain-models` directly.
 */
export function isSubprocessorBlockedForRegion(
  subprocessorId: string,
  region: Region | undefined | null,
): boolean {
  ensureSeeded();
  return registryIsSubprocessorBlocked(regionToCountryCode(region), subprocessorId);
}

// ---------------------------------------------------------------------------
// Org fiscal policy (tax authority + rates + invoice templates) — projected
// ---------------------------------------------------------------------------

/** @deprecated use JurisdictionConfig.taxRates and helpers from domain-models. */
export interface TaxRates {
  readonly vat: number;
  readonly whtRentResident: number;
  readonly whtRentNonResident: number;
  readonly mri: number | null;
}

/** @deprecated use JurisdictionConfig directly. */
export interface OrgFiscalPolicy {
  readonly fiscalCountry: Region;
  readonly fiscalAuthority: FiscalAuthority;
  readonly defaultCurrency: string;
  readonly invoiceTemplateId: string;
  readonly taxRates: TaxRates;
  readonly requiresFiscalSubmissionBeforeAuthoritative: boolean;
}

function fiscalAuthorityFromKey(key: string | undefined): FiscalAuthority {
  if (!key) return FiscalAuthority.NONE;
  const k = key.toLowerCase();
  if (k === 'kra') return FiscalAuthority.KRA;
  if (k === 'tra') return FiscalAuthority.TRA;
  return FiscalAuthority.NONE;
}

function findRate(config: JurisdictionConfig, key: string): number {
  const t = config.taxRates.find((r) => r.key === key);
  return t?.rate ?? 0;
}

function findRateOrNull(config: JurisdictionConfig, key: string): number | null {
  const t = config.taxRates.find((r) => r.key === key);
  return t?.rate ?? null;
}

function projectFiscalPolicy(config: JurisdictionConfig): OrgFiscalPolicy {
  const fa = config.fiscalAuthority;
  return {
    fiscalCountry: countryCodeToRegion(config.countryCode),
    fiscalAuthority: fa?.active ? fiscalAuthorityFromKey(fa.key) : FiscalAuthority.NONE,
    defaultCurrency: config.defaultCurrency,
    invoiceTemplateId: config.invoiceTemplateId,
    taxRates: {
      vat: findRate(config, 'vat'),
      whtRentResident: findRate(config, 'wht_resident'),
      whtRentNonResident: findRate(config, 'wht_nonresident'),
      mri: findRateOrNull(config, 'mri'),
    },
    requiresFiscalSubmissionBeforeAuthoritative:
      !!fa?.active && !!fa?.requiresPreAuthSubmission,
  };
}

/**
 * @deprecated use `getJurisdiction(countryCode)` from
 * `@bossnyumba/domain-models` directly.
 */
export function getOrgFiscalPolicy(
  fiscalCountry: Region | undefined | null,
): OrgFiscalPolicy {
  ensureSeeded();
  return projectFiscalPolicy(getJurisdiction(regionToCountryCode(fiscalCountry)));
}

/**
 * @deprecated use `requiresFiscalSubmission(countryCode, invoiceType)` from
 * `@bossnyumba/domain-models` directly. The shim returns true if the
 * jurisdiction's fiscal authority is active AND requires pre-auth
 * submission, regardless of invoice type (the legacy API was binary).
 */
export function requiresFiscalSubmission(
  fiscalCountry: Region | undefined | null,
): boolean {
  ensureSeeded();
  return getOrgFiscalPolicy(fiscalCountry).requiresFiscalSubmissionBeforeAuthoritative;
}
