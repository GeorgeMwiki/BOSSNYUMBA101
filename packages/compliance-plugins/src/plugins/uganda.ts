/**
 * Uganda (UG) compliance plugin.
 *
 * Based on the Landlord and Tenant Act 2022 and URA's rental income tax
 * framework. Mobile-money prefixes follow services/payments MTN adapter.
 */

import { buildPhoneNormalizer } from '../core/phone.js';
import type { CountryPlugin } from '../core/types.js';

export const ugandaPlugin: CountryPlugin = {
  countryCode: 'UG',
  countryName: 'Uganda',
  currencyCode: 'UGX',
  currencySymbol: 'USh',
  phoneCountryCode: '256',
  normalizePhone: buildPhoneNormalizer({ dialingCode: '256', trunkPrefix: '0' }),
  kycProviders: [
    {
      id: 'nira',
      name: 'National Identification and Registration Authority',
      kind: 'national-id',
      envPrefix: 'NIRA',
      idFormat: /^[A-Z0-9]{14}$/,
    },
    {
      id: 'ursb',
      name: 'Uganda Registration Services Bureau',
      kind: 'business-registry',
      envPrefix: 'URSB',
    },
    {
      id: 'ura',
      name: 'Uganda Revenue Authority',
      kind: 'tax-authority',
      envPrefix: 'URA',
      idFormat: /^\d{10}$/,
    },
  ],
  paymentGateways: [
    {
      id: 'mtn_momo',
      name: 'MTN Mobile Money (UG)',
      kind: 'mobile-money',
      envPrefix: 'MTN_MOMO',
    },
    {
      id: 'airtelmoney_ug',
      name: 'Airtel Money (UG)',
      kind: 'mobile-money',
      envPrefix: 'AIRTELMONEY',
    },
  ],
  compliance: {
    minDepositMonths: 1,
    maxDepositMonths: 3,
    noticePeriodDays: 60,
    minimumLeaseMonths: 6,
    subleaseConsent: 'consent-required',
    lateFeeCapRate: null,
    depositReturnDays: 30,
  },
  documentTemplates: [
    {
      id: 'lease-agreement',
      name: 'Residential Lease Agreement (UG)',
      templatePath: 'ug/lease-agreement.hbs',
      locale: 'en-UG',
    },
    {
      id: 'notice-of-termination',
      name: 'Notice of Termination (UG)',
      templatePath: 'ug/notice-of-termination.hbs',
      locale: 'en-UG',
    },
  ],
};
