/**
 * Nigeria (NG) compliance plugin.
 *
 * Defaults pull from the Tenancy Law of Lagos State (most common baseline);
 * state-level variants can override via a future sub-plugin pattern similar
 * to the US plugin's state hook.
 */

import { buildPhoneNormalizer } from '../core/phone.js';
import type { CountryPlugin } from '../core/types.js';

export const nigeriaPlugin: CountryPlugin = {
  countryCode: 'NG',
  countryName: 'Nigeria',
  currencyCode: 'NGN',
  currencySymbol: '\u20A6',
  phoneCountryCode: '234',
  normalizePhone: buildPhoneNormalizer({ dialingCode: '234', trunkPrefix: '0' }),
  kycProviders: [
    {
      id: 'nimc',
      name: 'National Identity Management Commission',
      kind: 'national-id',
      envPrefix: 'NIMC',
      idFormat: /^\d{11}$/,
    },
    {
      id: 'cac',
      name: 'Corporate Affairs Commission',
      kind: 'business-registry',
      envPrefix: 'CAC',
    },
    {
      id: 'firs',
      name: 'Federal Inland Revenue Service',
      kind: 'tax-authority',
      envPrefix: 'FIRS',
    },
    {
      id: 'cbn',
      name: 'Central Bank of Nigeria (BVN)',
      kind: 'credit-bureau',
      envPrefix: 'CBN',
      idFormat: /^\d{11}$/,
    },
  ],
  paymentGateways: [
    {
      id: 'paystack',
      name: 'Paystack',
      kind: 'card',
      envPrefix: 'PAYSTACK',
    },
    {
      id: 'flutterwave',
      name: 'Flutterwave',
      kind: 'card',
      envPrefix: 'FLUTTERWAVE',
    },
    {
      id: 'nibss',
      name: 'NIBSS Instant Payment',
      kind: 'bank-rail',
      envPrefix: 'NIBSS',
    },
  ],
  compliance: {
    minDepositMonths: 1,
    maxDepositMonths: 12,
    noticePeriodDays: 180,
    minimumLeaseMonths: 12,
    subleaseConsent: 'consent-required',
    lateFeeCapRate: null,
    depositReturnDays: 30,
  },
  documentTemplates: [
    {
      id: 'lease-agreement',
      name: 'Tenancy Agreement (NG)',
      templatePath: 'ng/lease-agreement.hbs',
      locale: 'en-NG',
    },
    {
      id: 'notice-of-termination',
      name: 'Quit Notice (NG)',
      templatePath: 'ng/notice-of-termination.hbs',
      locale: 'en-NG',
    },
  ],
};
