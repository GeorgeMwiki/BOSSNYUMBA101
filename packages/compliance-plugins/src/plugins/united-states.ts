/**
 * United States (US) compliance plugin.
 *
 * Landlord-tenant law is state-level in the US; this plugin exposes a
 * generic federal baseline (SSN/ITIN, IRS, FinCEN) plus a `withStateOverride`
 * helper so callers can stack state-specific rules without forking the plugin.
 *
 * The phone normalizer does NOT strip a trunk prefix — '0' is not a trunk
 * prefix in NANP; instead numbers are typed bare (e.g. '2025551234').
 */

import { buildPhoneNormalizer } from '../core/phone.js';
import type { CompliancePolicy, CountryPlugin } from '../core/types.js';

const baseUsPlugin: CountryPlugin = {
  countryCode: 'US',
  countryName: 'United States',
  currencyCode: 'USD',
  currencySymbol: '$',
  phoneCountryCode: '1',
  normalizePhone: buildPhoneNormalizer({ dialingCode: '1' }),
  kycProviders: [
    {
      id: 'ssn',
      name: 'Social Security Number',
      kind: 'national-id',
      envPrefix: 'SSN',
      idFormat: /^\d{3}-?\d{2}-?\d{4}$/,
    },
    {
      id: 'itin',
      name: 'Individual Taxpayer Identification Number',
      kind: 'national-id',
      envPrefix: 'ITIN',
      idFormat: /^9\d{2}-?\d{2}-?\d{4}$/,
    },
    {
      id: 'irs',
      name: 'Internal Revenue Service',
      kind: 'tax-authority',
      envPrefix: 'IRS',
    },
    {
      id: 'fincen',
      name: 'Financial Crimes Enforcement Network',
      kind: 'credit-bureau',
      envPrefix: 'FINCEN',
    },
  ],
  paymentGateways: [
    { id: 'stripe', name: 'Stripe', kind: 'card', envPrefix: 'STRIPE' },
    { id: 'ach', name: 'ACH Network', kind: 'bank-rail', envPrefix: 'ACH' },
    { id: 'plaid', name: 'Plaid', kind: 'bank-rail', envPrefix: 'PLAID' },
  ],
  compliance: {
    // Federal baseline — many states override these via withStateOverride().
    minDepositMonths: 1,
    maxDepositMonths: 2,
    noticePeriodDays: 30,
    minimumLeaseMonths: 1,
    subleaseConsent: 'consent-required',
    lateFeeCapRate: 0.05,
    depositReturnDays: 30,
  },
  documentTemplates: [
    {
      id: 'lease-agreement',
      name: 'Residential Lease Agreement (US Federal)',
      templatePath: 'us/lease-agreement.hbs',
      locale: 'en-US',
    },
    {
      id: 'notice-of-termination',
      name: 'Notice to Quit (US Federal)',
      templatePath: 'us/notice-of-termination.hbs',
      locale: 'en-US',
    },
  ],
};

export const unitedStatesPlugin: CountryPlugin = baseUsPlugin;

/**
 * Compose a state-overridden US plugin. Consumers pass the two-letter state
 * code plus a partial `CompliancePolicy` and get back a brand-new plugin
 * with every other field untouched — no mutation of the base plugin.
 */
export function withStateOverride(
  stateCode: string,
  override: Partial<CompliancePolicy>
): CountryPlugin {
  const normalized = stateCode.trim().toUpperCase();
  if (normalized.length !== 2) {
    throw new Error(
      `withStateOverride: state code must be 2 letters, got "${stateCode}"`
    );
  }
  return {
    ...baseUsPlugin,
    countryName: `United States (${normalized})`,
    compliance: { ...baseUsPlugin.compliance, ...override },
  };
}
