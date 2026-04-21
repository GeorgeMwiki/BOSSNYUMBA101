/**
 * Country-coverage subtree — barrel for the 12 jurisdictions added in the
 * PhJ-JURIS-BREADTH wave + a global fallback profile so unknown countries
 * still onboard with a sensible default.
 *
 * USAGE:
 *   import { resolveExtendedProfile, registerAllCountryPlugins } from
 *     '@bossnyumba/compliance-plugins';
 *
 *   // At process boot:
 *   registerAllCountryPlugins(countryPluginRegistry);
 *
 *   // In request code:
 *   const profile = resolveExtendedProfile('DE');
 *   profile.taxRegime.calculateWithholding(...);
 */

import type { CountryPluginRegistry } from '../core/registry.js';
import { buildPhoneNormalizer } from '../core/phone.js';
import type { CountryPlugin } from '../core/types.js';
import {
  DEFAULT_LEASE_LAW,
  DEFAULT_PAYMENT_RAIL_PORT,
  DEFAULT_TAX_REGIME,
  DEFAULT_TENANT_SCREENING,
} from '../ports/index.js';
import { setNationalIdResolver } from '../validators/national-id.js';

import { germanyProfile } from './de/index.js';
import { koreaProfile } from './kr/index.js';
import { ukProfile } from './gb/index.js';
import { singaporeProfile } from './sg/index.js';
import { canadaProfile } from './ca/index.js';
import { australiaProfile } from './au/index.js';
import { indiaProfile } from './in/index.js';
import { brazilProfile } from './br/index.js';
import { japanProfile } from './jp/index.js';
import { franceProfile } from './fr/index.js';
import { uaeProfile } from './ae/index.js';
import { mexicoProfile } from './mx/index.js';

import type { ExtendedCountryProfile } from './types.js';

export * from './types.js';

export {
  germanyProfile,
  koreaProfile,
  ukProfile,
  singaporeProfile,
  canadaProfile,
  australiaProfile,
  indiaProfile,
  brazilProfile,
  japanProfile,
  franceProfile,
  uaeProfile,
  mexicoProfile,
};

/** All profiles shipped by this wave, indexed by ISO-3166 alpha-2. */
export const EXTENDED_PROFILES: Readonly<Record<string, ExtendedCountryProfile>> =
  Object.freeze({
    DE: germanyProfile,
    KR: koreaProfile,
    GB: ukProfile,
    SG: singaporeProfile,
    CA: canadaProfile,
    AU: australiaProfile,
    IN: indiaProfile,
    BR: brazilProfile,
    JP: japanProfile,
    FR: franceProfile,
    AE: uaeProfile,
    MX: mexicoProfile,
  });

/**
 * GLOBAL fallback profile for any jurisdiction we don't ship yet.
 * Ships with:
 *   - USD currency (a neutral, universally-accepted reserve)
 *   - English language
 *   - Stripe + manual rails
 *   - Zero tax-regime stub (operator must configure)
 *   - Null national-id validator (onboarding accepts the value as-is)
 */
const globalCorePlugin: CountryPlugin = {
  countryCode: 'XX',
  countryName: 'Global (unconfigured jurisdiction)',
  currencyCode: 'USD',
  currencySymbol: '$',
  phoneCountryCode: '1',
  normalizePhone: buildPhoneNormalizer({ dialingCode: '1' }),
  kycProviders: [],
  paymentGateways: [
    { id: 'stripe', name: 'Stripe', kind: 'card', envPrefix: 'STRIPE' },
    {
      id: 'manual',
      name: 'Manual / bank transfer',
      kind: 'bank-rail',
      envPrefix: 'MANUAL',
    },
  ],
  compliance: {
    minDepositMonths: 0,
    maxDepositMonths: 2,
    noticePeriodDays: 30,
    minimumLeaseMonths: 1,
    subleaseConsent: 'consent-required',
    lateFeeCapRate: null,
    depositReturnDays: 30,
  },
  documentTemplates: [],
};

export const GLOBAL_DEFAULT_PROFILE: ExtendedCountryProfile = {
  plugin: globalCorePlugin,
  languages: ['en'],
  dateFormat: 'YYYY-MM-DD',
  minorUnitDivisor: 100,
  nationalIdValidator: null,
  taxRegime: DEFAULT_TAX_REGIME,
  paymentRails: DEFAULT_PAYMENT_RAIL_PORT,
  leaseLaw: DEFAULT_LEASE_LAW,
  tenantScreening: DEFAULT_TENANT_SCREENING,
};

/**
 * Register every extended country plugin with the core registry so the
 * legacy `getCountryPlugin(code)` call path also returns these new
 * jurisdictions.
 */
export function registerAllCountryPlugins(
  registry: CountryPluginRegistry
): void {
  for (const profile of Object.values(EXTENDED_PROFILES)) {
    // Inline the port implementations onto the plugin object so downstream
    // `resolvePlugin(countryCode)` surfaces them via `.taxRegime` etc.
    // Cast to the public CountryPlugin type — the additional fields are
    // read via structural property access in ResolvedCountryPlugin.
    registry.register({
      ...profile.plugin,
      taxRegime: profile.taxRegime,
      paymentRails: profile.paymentRails,
      leaseLaw: profile.leaseLaw,
      tenantScreening: profile.tenantScreening,
    } as unknown as import('../core/types.js').CountryPlugin);
  }
}

/**
 * Resolve the extended profile for `countryCode` (case-insensitive).
 * Falls back to GLOBAL_DEFAULT_PROFILE when unknown.
 */
export function resolveExtendedProfile(
  countryCode: string | null | undefined
): ExtendedCountryProfile {
  if (!countryCode) return GLOBAL_DEFAULT_PROFILE;
  const iso = countryCode.trim().toUpperCase();
  return EXTENDED_PROFILES[iso] ?? GLOBAL_DEFAULT_PROFILE;
}

/**
 * Best-effort default country for tenant onboarding forms. Real IP-based
 * geolocation is out of scope for this wave — callers wire that in later.
 * Today: returns the first registered profile's country as a deterministic
 * hint ('DE' when extended profiles are present).
 */
export function getTenantCountryDefault(): string {
  return 'DE';
}

// ---------------------------------------------------------------------------
// Wire the universal national-ID resolver so validateNationalId(raw, 'DE')
// reaches germanyProfile.nationalIdValidator. Called at module load.
// ---------------------------------------------------------------------------

setNationalIdResolver((iso) => {
  const profile = EXTENDED_PROFILES[iso];
  if (profile?.nationalIdValidator) return profile.nationalIdValidator;
  return null;
});
