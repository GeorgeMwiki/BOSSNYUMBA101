/**
 * Kenya (KE) compliance plugin.
 *
 * Rules reflect the Distress for Rent Act, Rent Restriction Act, and KRA's
 * Monthly Rental Income (MRI) regime. Env-var prefixes follow the existing
 * services/payments mpesa-safaricom and services/identity KRA adapters.
 */

import { buildPhoneNormalizer } from '../core/phone.js';
import type { CountryPlugin } from '../core/types.js';

export const kenyaPlugin: CountryPlugin = {
  countryCode: 'KE',
  countryName: 'Kenya',
  currencyCode: 'KES',
  currencySymbol: 'KSh',
  phoneCountryCode: '254',
  normalizePhone: buildPhoneNormalizer({ dialingCode: '254', trunkPrefix: '0' }),
  kycProviders: [
    {
      id: 'iprs',
      name: 'Integrated Population Registration System',
      kind: 'national-id',
      envPrefix: 'IPRS',
      idFormat: /^\d{7,9}$/,
    },
    {
      id: 'crb-ke',
      name: 'Credit Reference Bureau (KE)',
      kind: 'credit-bureau',
      envPrefix: 'CRB_KE',
    },
    {
      id: 'ecitizen',
      name: 'eCitizen Business Registry',
      kind: 'business-registry',
      envPrefix: 'ECITIZEN',
    },
    {
      id: 'kra',
      name: 'Kenya Revenue Authority (iTax)',
      kind: 'tax-authority',
      envPrefix: 'KRA',
      idFormat: /^[A-Z]\d{9}[A-Z]$/,
    },
  ],
  paymentGateways: [
    {
      id: 'mpesa_ke',
      name: 'M-Pesa (Safaricom)',
      kind: 'mobile-money',
      envPrefix: 'MPESA',
    },
    {
      id: 'airtelmoney_ke',
      name: 'Airtel Money (KE)',
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
    lateFeeCapRate: 0.1,
    depositReturnDays: 14,
  },
  documentTemplates: [
    {
      id: 'lease-agreement',
      name: 'Residential Lease Agreement (KE)',
      templatePath: 'ke/lease-agreement.hbs',
      locale: 'en-KE',
    },
    {
      id: 'notice-of-termination',
      name: 'Notice of Termination (KE)',
      templatePath: 'ke/notice-of-termination.hbs',
      locale: 'en-KE',
    },
  ],
};
