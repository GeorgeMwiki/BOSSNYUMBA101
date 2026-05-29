/**
 * Kenya (KE) — first-class country profile (M-3 regulator pack expansion).
 *
 * Source: Income Tax Act Cap. 470 § 35(1)(d) + Finance Act 2024 — KRA
 * Monthly Rental Income (MRI) at a flat 7.5% for residential landlords
 * below the VAT threshold; commercial / above-threshold landlords switch
 * to corporate rate via standard income-tax route.
 *
 * Lease law: Landlord and Tenant (Shops, Hotels and Catering
 * Establishments) Act Cap. 301 (controlled commercial tenancies) +
 * Rent Restriction Act Cap. 296 (legacy protected residential rents
 * below KSh 2,500/mo). Modern leases default to free-market with the
 * Distress for Rent Act (Cap. 293) governing rent-arrears recovery.
 *
 * Data protection: Data Protection Act, 2019 (Act No. 24 of 2019)
 * administered by the Office of the Data Protection Commissioner
 * (ODPC). Breach notify within 72 hours; no blanket localisation.
 *
 * Identity: Huduma Namba — 7-9 digits; KRA PIN format A123456789B.
 * Phone: E.164 +254. Mobile prefixes 7XX / 1XX (Safaricom 70-74, 79;
 * Airtel 73, 75, 78; Telkom T-Kash 77).
 */

import { buildPhoneNormalizer } from '../../core/phone.js';
import type { CountryPlugin } from '../../core/types.js';
import {
  buildLeaseLawPort,
  buildPaymentRailsPort,
  buildStubScreeningPort,
  buildFlatWithholding,
} from '../_shared.js';
import type { ExtendedCountryProfile, NationalIdValidator } from '../types.js';

const HUDUMA_PATTERN = /^\d{7,9}$/;

const hudumaValidator: NationalIdValidator = {
  id: 'ke-huduma',
  label: 'Huduma Namba (National ID, KE)',
  validate(raw: string) {
    if (!raw || raw.trim().length === 0) {
      return {
        status: 'invalid',
        ruleId: 'ke-huduma',
        note: 'Huduma Namba is empty.',
        piiSensitive: true,
      };
    }
    if (HUDUMA_PATTERN.test(raw.trim())) {
      return { status: 'valid', ruleId: 'ke-huduma', piiSensitive: true };
    }
    return {
      status: 'invalid',
      ruleId: 'ke-huduma',
      note: 'Huduma Namba must be 7-9 digits.',
      piiSensitive: true,
    };
  },
};

const kenyaCore: CountryPlugin = {
  countryCode: 'KE',
  countryName: 'Kenya',
  currencyCode: 'KES',
  currencySymbol: 'KSh',
  phoneCountryCode: '254',
  normalizePhone: buildPhoneNormalizer({ dialingCode: '254', trunkPrefix: '0' }),
  kycProviders: [
    {
      id: 'huduma',
      name: 'Huduma Namba (National ID)',
      kind: 'national-id',
      envPrefix: 'HUDUMA',
      idFormat: /^\d{7,9}$/,
    },
    {
      id: 'kra',
      name: 'Kenya Revenue Authority (PIN)',
      kind: 'tax-authority',
      envPrefix: 'KRA',
      idFormat: /^[A-Z]\d{9}[A-Z]$/,
    },
    {
      id: 'crb-ke',
      name: 'Credit Reference Bureau (KE)',
      kind: 'credit-bureau',
      envPrefix: 'CRB_KE',
    },
    {
      id: 'brs-ke',
      name: 'Business Registration Service',
      kind: 'business-registry',
      envPrefix: 'BRS_KE',
    },
  ],
  paymentGateways: [
    { id: 'mpesa_ke', name: 'M-Pesa (Safaricom KE)', kind: 'mobile-money', envPrefix: 'MPESA_KE' },
    { id: 'airtelmoney_ke', name: 'Airtel Money (KE)', kind: 'mobile-money', envPrefix: 'AIRTELMONEY_KE' },
    { id: 't_kash', name: 'T-Kash (Telkom KE)', kind: 'mobile-money', envPrefix: 'T_KASH' },
    { id: 'pesalink', name: 'PesaLink (IPSL)', kind: 'bank-rail', envPrefix: 'PESALINK' },
    { id: 'ke_bank_transfer', name: 'Bank transfer (KE)', kind: 'bank-rail', envPrefix: 'KE_BANK' },
    { id: 'stripe', name: 'Stripe', kind: 'card', envPrefix: 'STRIPE' },
  ],
  compliance: {
    minDepositMonths: 1,
    maxDepositMonths: 2,
    noticePeriodDays: 60,
    minimumLeaseMonths: 6,
    subleaseConsent: 'consent-required',
    lateFeeCapRate: null,
    depositReturnDays: 14,
  },
  documentTemplates: [
    {
      id: 'lease-agreement',
      name: 'Mkataba wa Upangaji (KE Residential Lease)',
      templatePath: 'ke/lease-agreement.hbs',
      locale: 'sw-KE',
    },
    {
      id: 'notice-of-termination',
      name: 'Notice of Termination (KE)',
      templatePath: 'ke/notice-of-termination.hbs',
      locale: 'en-KE',
    },
  ],
};

export const kenyaProfile: ExtendedCountryProfile = {
  plugin: kenyaCore,
  languages: ['sw', 'en'],
  dateFormat: 'DD/MM/YYYY',
  minorUnitDivisor: 100,
  nationalIdValidator: hudumaValidator,
  taxRegime: buildFlatWithholding(
    7.5,
    'KRA-MRI',
    'KRA Monthly Rental Income at flat 7.5% (Finance Act 2024 effective Jan 2024). Applies to residential landlords below the VAT threshold.'
  ),
  paymentRails: buildPaymentRailsPort([
    {
      id: 'mpesa_ke',
      label: 'M-Pesa (Safaricom KE)',
      kind: 'mobile-money',
      currency: 'KES',
      minAmountMinorUnits: 100,
      settlementLagHours: 1,
      integrationAdapterHint: 'MPESA_KE',
      supportsCollection: true,
      supportsDisbursement: true,
    },
    {
      id: 'airtelmoney_ke',
      label: 'Airtel Money (KE)',
      kind: 'mobile-money',
      currency: 'KES',
      minAmountMinorUnits: 100,
      settlementLagHours: 2,
      integrationAdapterHint: 'AIRTELMONEY_KE',
      supportsCollection: true,
      supportsDisbursement: true,
    },
    {
      id: 't_kash',
      label: 'T-Kash (Telkom KE)',
      kind: 'mobile-money',
      currency: 'KES',
      minAmountMinorUnits: 100,
      settlementLagHours: 4,
      integrationAdapterHint: 'T_KASH',
      supportsCollection: true,
      supportsDisbursement: true,
    },
    {
      id: 'pesalink',
      label: 'PesaLink',
      kind: 'bank-transfer',
      currency: 'KES',
      minAmountMinorUnits: 1000,
      settlementLagHours: 1,
      integrationAdapterHint: 'PESALINK',
      supportsCollection: true,
      supportsDisbursement: true,
    },
    {
      id: 'ke_bank_transfer',
      label: 'Bank transfer (KES)',
      kind: 'bank-transfer',
      currency: 'KES',
      minAmountMinorUnits: 1000,
      settlementLagHours: 24,
      integrationAdapterHint: 'KE_BANK',
      supportsCollection: true,
      supportsDisbursement: true,
    },
    {
      id: 'stripe',
      label: 'Stripe (card)',
      kind: 'card',
      currency: 'KES',
      minAmountMinorUnits: 500,
      settlementLagHours: 48,
      integrationAdapterHint: 'STRIPE',
      supportsCollection: true,
      supportsDisbursement: false,
    },
  ]),
  leaseLaw: buildLeaseLawPort({
    requiredClauses: [
      {
        id: 'ke-parties',
        label: 'Parties (landlord + tenant, full legal names, addresses)',
        mandatory: true,
        citation: 'Land Act 2012 §54.',
      },
      {
        id: 'ke-premises',
        label: 'Description of premises (LR number, district, locality)',
        mandatory: true,
        citation: 'Land Registration Act 2012 §28.',
      },
      {
        id: 'ke-rent',
        label: 'Rent amount and payment frequency, denominated in KES',
        mandatory: true,
        citation: 'Land Act 2012 §57.',
      },
      {
        id: 'ke-kra-pin',
        label: 'Landlord KRA PIN disclosure (for MRI compliance)',
        mandatory: true,
        citation: 'Income Tax Act Cap. 470 §35 + Finance Act 2024 (MRI).',
      },
      {
        id: 'ke-deposit',
        label: 'Deposit amount and return conditions',
        mandatory: true,
        citation: 'Landlord and Tenant Bill 2021 (pending) §10.',
      },
      {
        id: 'ke-notice',
        label: 'Notice period and termination grounds',
        mandatory: true,
        citation: 'L&T (Shops, Hotels & Catering Establishments) Act Cap. 301 §4.',
      },
    ],
    noticeWindowDaysByReason: {
      'non-payment': 14,
      'end-of-term': 60,
      'renewal-non-continuation': 60,
      'landlord-repossession': 90,
      'breach-of-covenant': 30,
      'illegal-use': 14,
      nuisance: 14,
    },
    depositCapByRegime: {
      'residential-standard': {
        maxMonthsOfRent: 2,
        citation: 'Market norm. Pending Landlord & Tenant Bill 2021 §10 codifies the 2-month cap.',
      },
      commercial: {
        maxMonthsOfRent: 6,
        citation: 'Commercial norm; tribunal arbitrates disputes via Business Premises Rent Tribunal.',
      },
      'residential-rent-controlled': {
        maxMonthsOfRent: 1,
        citation: 'Rent Restriction Act Cap. 296 §13 — controlled tenancies (legacy stock below KSh 2,500/mo).',
      },
    },
    rentIncreaseCapByRegime: {
      'residential-standard': {
        citation: 'No statutory cap. Disputes arbitrated by Rent Restriction Tribunal under Cap. 296.',
      },
      commercial: {
        citation: 'L&T Act Cap. 301 §6 — controlled commercial tenancies require Business Premises Rent Tribunal consent.',
      },
    },
    defaultNoticeWindowDays: 60,
  }),
  tenantScreening: buildStubScreeningPort('CRB_KE'),
};
