/**
 * Tanzania (TZ) compliance plugin.
 *
 * Preserves every piece of Tanzania-specific logic that used to live inline
 * in identity / payments / tax services. Env-var prefixes match the existing
 * `.env` patterns — real credentials stay in the environment, never in code.
 *
 * Statutory defaults (notice periods, deposit caps) sourced from Tanzania's
 * Land (Landlord and Tenant) Act. Confirm with counsel before going live.
 */

import { buildPhoneNormalizer } from '../core/phone.js';
import type { CountryPlugin } from '../core/types.js';

export const tanzaniaPlugin: CountryPlugin = {
  countryCode: 'TZ',
  countryName: 'Tanzania',
  currencyCode: 'TZS',
  currencySymbol: 'TSh',
  phoneCountryCode: '255',
  normalizePhone: buildPhoneNormalizer({ dialingCode: '255', trunkPrefix: '0' }),
  kycProviders: [
    {
      id: 'nida',
      name: 'National Identification Authority',
      kind: 'national-id',
      envPrefix: 'NIDA',
      idFormat: /^\d{20}$/,
    },
    {
      id: 'crb-tz',
      name: 'Credit Reference Bureau (TZ)',
      kind: 'credit-bureau',
      envPrefix: 'CRB_TZ',
    },
    {
      id: 'brela',
      name: 'Business Registrations and Licensing Agency',
      kind: 'business-registry',
      envPrefix: 'BRELA',
    },
    {
      id: 'tra',
      name: 'Tanzania Revenue Authority',
      kind: 'tax-authority',
      envPrefix: 'TRA',
      idFormat: /^\d{9}$/,
    },
  ],
  paymentGateways: [
    {
      id: 'gepg',
      name: 'Government Electronic Payment Gateway',
      kind: 'government-portal',
      envPrefix: 'GEPG',
    },
    {
      id: 'mpesa_tz',
      name: 'M-Pesa (Vodacom)',
      kind: 'mobile-money',
      envPrefix: 'MPESA',
    },
    {
      id: 'tigopesa',
      name: 'Tigo Pesa',
      kind: 'mobile-money',
      envPrefix: 'TIGOPESA',
    },
    {
      id: 'airtelmoney_tz',
      name: 'Airtel Money (TZ)',
      kind: 'mobile-money',
      envPrefix: 'AIRTELMONEY',
    },
    {
      id: 'halopesa',
      name: 'Halopesa',
      kind: 'mobile-money',
      envPrefix: 'HALOPESA',
    },
  ],
  compliance: {
    minDepositMonths: 1,
    maxDepositMonths: 6,
    noticePeriodDays: 90,
    minimumLeaseMonths: 6,
    subleaseConsent: 'consent-required',
    lateFeeCapRate: null,
    depositReturnDays: 30,
  },
  documentTemplates: [
    {
      id: 'lease-agreement',
      name: 'Residential Lease Agreement (TZ)',
      templatePath: 'tz/lease-agreement.hbs',
      locale: 'sw-TZ',
    },
    {
      id: 'notice-of-termination',
      name: 'Notice of Termination (TZ)',
      templatePath: 'tz/notice-of-termination.hbs',
      locale: 'sw-TZ',
    },
  ],
};
