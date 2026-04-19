/**
 * South Africa (ZA) compliance plugin.
 *
 * Defaults based on the Rental Housing Act 50 of 1999 and SARS requirements.
 * Rental Housing Tribunal handles disputes — surfaced as a tax-authority-
 * adjacent KYC provider so downstream UI knows the dispute channel.
 */

import { buildPhoneNormalizer } from '../core/phone.js';
import type { CountryPlugin } from '../core/types.js';

export const southAfricaPlugin: CountryPlugin = {
  countryCode: 'ZA',
  countryName: 'South Africa',
  currencyCode: 'ZAR',
  currencySymbol: 'R',
  phoneCountryCode: '27',
  normalizePhone: buildPhoneNormalizer({ dialingCode: '27', trunkPrefix: '0' }),
  kycProviders: [
    {
      id: 'home-affairs',
      name: 'Department of Home Affairs',
      kind: 'national-id',
      envPrefix: 'HOME_AFFAIRS',
      idFormat: /^\d{13}$/,
    },
    {
      id: 'cipc',
      name: 'Companies and Intellectual Property Commission',
      kind: 'business-registry',
      envPrefix: 'CIPC',
    },
    {
      id: 'sars',
      name: 'South African Revenue Service',
      kind: 'tax-authority',
      envPrefix: 'SARS',
      idFormat: /^\d{10}$/,
    },
    {
      id: 'rht',
      name: 'Rental Housing Tribunal',
      kind: 'credit-bureau',
      envPrefix: 'RHT',
    },
  ],
  paymentGateways: [
    {
      id: 'payfast',
      name: 'PayFast',
      kind: 'card',
      envPrefix: 'PAYFAST',
    },
    {
      id: 'eft',
      name: 'EFT (SA bank rail)',
      kind: 'bank-rail',
      envPrefix: 'EFT_ZA',
    },
  ],
  compliance: {
    minDepositMonths: 1,
    maxDepositMonths: 2,
    noticePeriodDays: 20,
    minimumLeaseMonths: 1,
    subleaseConsent: 'consent-required',
    lateFeeCapRate: null,
    depositReturnDays: 14,
  },
  documentTemplates: [
    {
      id: 'lease-agreement',
      name: 'Residential Lease Agreement (ZA)',
      templatePath: 'za/lease-agreement.hbs',
      locale: 'en-ZA',
    },
    {
      id: 'notice-of-termination',
      name: 'Notice of Termination (ZA)',
      templatePath: 'za/notice-of-termination.hbs',
      locale: 'en-ZA',
    },
  ],
};
