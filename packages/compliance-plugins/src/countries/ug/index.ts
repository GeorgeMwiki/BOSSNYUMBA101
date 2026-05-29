/**
 * Uganda (UG) — first-class country profile (M-3 regulator pack expansion).
 *
 * Source: Income Tax Act Cap. 340 — rental income from residential
 * lettings of individuals is taxed at 12% on chargeable amount (gross
 * rent less 75% deemed expense, leaving 25% taxable; effective rate
 * approximately 3%). Companies pay 30% on net rental income. Rental
 * Tax administered by Uganda Revenue Authority (URA).
 *
 * Lease law: Landlord and Tenant Act, 2022 (Act No. 4 of 2022) —
 * codifies notice windows, deposit caps, and Land Division of the High
 * Court jurisdiction for landlord-tenant disputes. Replaces the
 * common-law regime. Maximum deposit: 1 month for residential, 3
 * months for commercial.
 *
 * Data protection: Data Protection and Privacy Act, 2019 administered
 * by the Personal Data Protection Office (PDPO) within NITA-U.
 *
 * Identity: NIN issued by NIRA; 14 alphanumeric (CM/CF + 12). URA TIN
 * is 10 digits.
 *
 * Phone: E.164 +256. Mobile prefixes 70-79.
 * Mobile money: MTN MoMo Uganda (~55%), Airtel Money Uganda (~40%).
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

const NIN_PATTERN = /^C[MF][A-Z0-9]{12}$/;

const ninValidator: NationalIdValidator = {
  id: 'ug-nin',
  label: 'National Identification Number (NIN, UG)',
  validate(raw: string) {
    if (!raw || raw.trim().length === 0) {
      return {
        status: 'invalid',
        ruleId: 'ug-nin',
        note: 'NIN is empty.',
        piiSensitive: true,
      };
    }
    if (NIN_PATTERN.test(raw.trim().toUpperCase())) {
      return { status: 'valid', ruleId: 'ug-nin', piiSensitive: true };
    }
    return {
      status: 'invalid',
      ruleId: 'ug-nin',
      note: 'NIN must be CM/CF + 12 alphanumeric characters (14 total).',
      piiSensitive: true,
    };
  },
};

const ugandaCore: CountryPlugin = {
  countryCode: 'UG',
  countryName: 'Uganda',
  currencyCode: 'UGX',
  currencySymbol: 'USh',
  phoneCountryCode: '256',
  normalizePhone: buildPhoneNormalizer({ dialingCode: '256', trunkPrefix: '0' }),
  kycProviders: [
    {
      id: 'nira',
      name: 'National Identification & Registration Authority',
      kind: 'national-id',
      envPrefix: 'NIRA',
      idFormat: /^C[MF][A-Z0-9]{12}$/i,
    },
    {
      id: 'ura',
      name: 'Uganda Revenue Authority (TIN)',
      kind: 'tax-authority',
      envPrefix: 'URA',
      idFormat: /^\d{10}$/,
    },
    {
      id: 'crb-ug',
      name: 'Compuscan / Metropol (UG CRB)',
      kind: 'credit-bureau',
      envPrefix: 'CRB_UG',
    },
    {
      id: 'ursb',
      name: 'Uganda Registration Services Bureau',
      kind: 'business-registry',
      envPrefix: 'URSB',
    },
  ],
  paymentGateways: [
    { id: 'mtn_momo_ug', name: 'MTN MoMo (UG)', kind: 'mobile-money', envPrefix: 'MTN_MOMO_UG' },
    { id: 'airtelmoney_ug', name: 'Airtel Money (UG)', kind: 'mobile-money', envPrefix: 'AIRTELMONEY_UG' },
    { id: 'ug_bank_transfer', name: 'Bank transfer (UG RTGS / EFT)', kind: 'bank-rail', envPrefix: 'UG_BANK' },
    { id: 'stripe', name: 'Stripe', kind: 'card', envPrefix: 'STRIPE' },
  ],
  compliance: {
    minDepositMonths: 0,
    maxDepositMonths: 1,
    noticePeriodDays: 90,
    minimumLeaseMonths: 6,
    subleaseConsent: 'consent-required',
    lateFeeCapRate: null,
    depositReturnDays: 30,
  },
  documentTemplates: [
    {
      id: 'lease-agreement',
      name: 'Residential Tenancy Agreement (UG)',
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

export const ugandaProfile: ExtendedCountryProfile = {
  plugin: ugandaCore,
  languages: ['en'],
  dateFormat: 'DD/MM/YYYY',
  minorUnitDivisor: 1,
  nationalIdValidator: ninValidator,
  taxRegime: buildFlatWithholding(
    3,
    'URA-RENTAL-IND',
    'URA rental tax — individuals taxed on 25% of gross rent at 12% (effective ~3% of gross). Income Tax Act Cap. 340.'
  ),
  paymentRails: buildPaymentRailsPort([
    {
      id: 'mtn_momo_ug',
      label: 'MTN MoMo (UG)',
      kind: 'mobile-money',
      currency: 'UGX',
      minAmountMinorUnits: 1000,
      settlementLagHours: 1,
      integrationAdapterHint: 'MTN_MOMO_UG',
      supportsCollection: true,
      supportsDisbursement: true,
    },
    {
      id: 'airtelmoney_ug',
      label: 'Airtel Money (UG)',
      kind: 'mobile-money',
      currency: 'UGX',
      minAmountMinorUnits: 1000,
      settlementLagHours: 2,
      integrationAdapterHint: 'AIRTELMONEY_UG',
      supportsCollection: true,
      supportsDisbursement: true,
    },
    {
      id: 'ug_bank_transfer',
      label: 'Bank transfer (UGX EFT/RTGS)',
      kind: 'bank-transfer',
      currency: 'UGX',
      minAmountMinorUnits: 10_000,
      settlementLagHours: 24,
      integrationAdapterHint: 'UG_BANK',
      supportsCollection: true,
      supportsDisbursement: true,
    },
    {
      id: 'stripe',
      label: 'Stripe (card)',
      kind: 'card',
      currency: 'UGX',
      minAmountMinorUnits: 1000,
      settlementLagHours: 48,
      integrationAdapterHint: 'STRIPE',
      supportsCollection: true,
      supportsDisbursement: false,
    },
  ]),
  leaseLaw: buildLeaseLawPort({
    requiredClauses: [
      {
        id: 'ug-parties',
        label: 'Parties (landlord + tenant, full legal names)',
        mandatory: true,
        citation: 'Landlord and Tenant Act 2022 §29.',
      },
      {
        id: 'ug-premises',
        label: 'Description of premises (plot, block, district)',
        mandatory: true,
        citation: 'Landlord and Tenant Act 2022 §29(2).',
      },
      {
        id: 'ug-rent',
        label: 'Rent amount and payment frequency, denominated in UGX or USD',
        mandatory: true,
        citation: 'Landlord and Tenant Act 2022 §30.',
      },
      {
        id: 'ug-ura-tin',
        label: 'Landlord URA TIN disclosure',
        mandatory: true,
        citation: 'Income Tax Act Cap. 340 §83 (withholding-agent duty).',
      },
      {
        id: 'ug-deposit',
        label: 'Deposit amount (capped at 1 month for residential)',
        mandatory: true,
        citation: 'Landlord and Tenant Act 2022 §32.',
      },
      {
        id: 'ug-notice',
        label: 'Notice period and termination grounds',
        mandatory: true,
        citation: 'Landlord and Tenant Act 2022 §56.',
      },
    ],
    noticeWindowDaysByReason: {
      'non-payment': 30,
      'end-of-term': 90,
      'renewal-non-continuation': 90,
      'landlord-repossession': 180,
      'breach-of-covenant': 30,
      'illegal-use': 14,
      nuisance: 14,
    },
    depositCapByRegime: {
      'residential-standard': {
        maxMonthsOfRent: 1,
        citation: 'Landlord and Tenant Act 2022 §32 — residential deposit cap.',
      },
      commercial: {
        maxMonthsOfRent: 3,
        citation: 'Landlord and Tenant Act 2022 §32 — commercial deposit cap.',
      },
    },
    rentIncreaseCapByRegime: {
      'residential-standard': {
        citation: 'Landlord and Tenant Act 2022 §27 — increases require 90-day notice; tenant may petition Land Division for review.',
      },
      commercial: {
        citation: 'Freely negotiated; subject to lease covenants.',
      },
    },
    defaultNoticeWindowDays: 90,
  }),
  tenantScreening: buildStubScreeningPort('CRB_UG'),
};
