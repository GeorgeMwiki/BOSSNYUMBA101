/**
 * Nigeria (NG) — first-class country profile (M-3 regulator pack expansion).
 *
 * Source: CITA §81 (corporate) + PITA §73 (individual) — 10% withholding
 * on rent above NGN 10,000/annum. FIRS administers corporate; State
 * Internal Revenue Services administer personal income tax. The new
 * Nigeria Tax Act 2025 (effective 01 Jan 2026) introduced a 13-digit
 * NRS Tax ID derived from NIN/CAC RC.
 *
 * Lease law (federal vs state):
 *   - Recovery of Premises Act Cap. R10 LFN 2004 — FCT Abuja default.
 *   - Lagos State Tenancy Law No. 14 of 2011 — Lagos default.
 *   - Rivers State Tenancy Law 2019 — Rivers default.
 *
 * Notice windows (Recovery of Premises Act §7 + Lagos Tenancy Law §13):
 *   - Yearly tenancies: 6 months.
 *   - Monthly tenancies: 1 month.
 *   - Weekly tenancies: 1 week.
 *
 * Data protection: Nigeria Data Protection Act, 2023 (NDPA)
 * administered by the Nigeria Data Protection Commission (NDPC).
 * Breach notify within 72 hours.
 *
 * Identity: NIN (11 digits, NIMC). TIN: legacy 12-digit OR new 13-
 * digit NRS Tax ID (Nigeria Tax Act 2025).
 *
 * Phone: E.164 +234. Mobile NSN 10 digits starting 7X/8X/9X.
 * Mobile money: OPay (~40%), PalmPay (~25%), Moniepoint (~20%).
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

const NIN_PATTERN = /^\d{11}$/;

const ninValidator: NationalIdValidator = {
  id: 'ng-nin',
  label: 'National Identification Number (NIN, NG)',
  validate(raw: string) {
    if (!raw || raw.trim().length === 0) {
      return {
        status: 'invalid',
        ruleId: 'ng-nin',
        note: 'NIN is empty.',
        piiSensitive: true,
      };
    }
    if (NIN_PATTERN.test(raw.trim())) {
      return { status: 'valid', ruleId: 'ng-nin', piiSensitive: true };
    }
    return {
      status: 'invalid',
      ruleId: 'ng-nin',
      note: 'NIN must be 11 digits.',
      piiSensitive: true,
    };
  },
};

const nigeriaCore: CountryPlugin = {
  countryCode: 'NG',
  countryName: 'Nigeria',
  currencyCode: 'NGN',
  currencySymbol: 'NGN',
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
      id: 'firs',
      name: 'Federal Inland Revenue Service (TIN)',
      kind: 'tax-authority',
      envPrefix: 'FIRS',
      idFormat: /^\d{12,13}$/,
    },
    {
      id: 'crb-ng',
      name: 'Credit Bureau (CRC / CreditRegistry / FirstCentral)',
      kind: 'credit-bureau',
      envPrefix: 'CRB_NG',
    },
    {
      id: 'cac',
      name: 'Corporate Affairs Commission',
      kind: 'business-registry',
      envPrefix: 'CAC',
    },
  ],
  paymentGateways: [
    { id: 'opay_ng', name: 'OPay', kind: 'mobile-money', envPrefix: 'OPAY_NG' },
    { id: 'palmpay_ng', name: 'PalmPay', kind: 'mobile-money', envPrefix: 'PALMPAY_NG' },
    { id: 'moniepoint_ng', name: 'Moniepoint', kind: 'mobile-money', envPrefix: 'MONIEPOINT_NG' },
    { id: 'nibss_nip', name: 'NIBSS NIP (Instant Payment)', kind: 'bank-rail', envPrefix: 'NIBSS_NIP' },
    { id: 'ng_bank_transfer', name: 'Bank transfer (NGN)', kind: 'bank-rail', envPrefix: 'NG_BANK' },
    { id: 'stripe', name: 'Stripe', kind: 'card', envPrefix: 'STRIPE' },
  ],
  compliance: {
    minDepositMonths: 1,
    maxDepositMonths: 6,
    noticePeriodDays: 180,
    minimumLeaseMonths: 12,
    subleaseConsent: 'consent-required',
    lateFeeCapRate: null,
    depositReturnDays: 30,
  },
  documentTemplates: [
    {
      id: 'lease-agreement',
      name: 'Residential Lease Agreement (NG)',
      templatePath: 'ng/lease-agreement.hbs',
      locale: 'en-NG',
    },
    {
      id: 'quit-notice',
      name: 'Notice to Quit (NG)',
      templatePath: 'ng/quit-notice.hbs',
      locale: 'en-NG',
    },
    {
      id: 'owner-intention-notice',
      name: 'Owner\'s Intention to Recover Possession (NG)',
      templatePath: 'ng/owner-intention.hbs',
      locale: 'en-NG',
    },
  ],
};

export const nigeriaProfile: ExtendedCountryProfile = {
  plugin: nigeriaCore,
  languages: ['en'],
  dateFormat: 'DD/MM/YYYY',
  minorUnitDivisor: 100,
  nationalIdValidator: ninValidator,
  taxRegime: buildFlatWithholding(
    10,
    'FIRS-WHT-RENT',
    'FIRS / SIRS withholding on rent — 10% on amounts above NGN 10,000/annum. CITA §81 (companies) + PITA §73 (individuals).'
  ),
  paymentRails: buildPaymentRailsPort([
    {
      id: 'opay_ng',
      label: 'OPay',
      kind: 'mobile-money',
      currency: 'NGN',
      minAmountMinorUnits: 1000,
      settlementLagHours: 1,
      integrationAdapterHint: 'OPAY_NG',
      supportsCollection: true,
      supportsDisbursement: true,
    },
    {
      id: 'palmpay_ng',
      label: 'PalmPay',
      kind: 'mobile-money',
      currency: 'NGN',
      minAmountMinorUnits: 1000,
      settlementLagHours: 1,
      integrationAdapterHint: 'PALMPAY_NG',
      supportsCollection: true,
      supportsDisbursement: true,
    },
    {
      id: 'moniepoint_ng',
      label: 'Moniepoint',
      kind: 'mobile-money',
      currency: 'NGN',
      minAmountMinorUnits: 1000,
      settlementLagHours: 1,
      integrationAdapterHint: 'MONIEPOINT_NG',
      supportsCollection: true,
      supportsDisbursement: true,
    },
    {
      id: 'nibss_nip',
      label: 'NIBSS NIP (Instant Payment)',
      kind: 'bank-transfer',
      currency: 'NGN',
      minAmountMinorUnits: 100,
      settlementLagHours: 1,
      integrationAdapterHint: 'NIBSS_NIP',
      supportsCollection: true,
      supportsDisbursement: true,
    },
    {
      id: 'ng_bank_transfer',
      label: 'Bank transfer (NGN)',
      kind: 'bank-transfer',
      currency: 'NGN',
      minAmountMinorUnits: 10_000,
      settlementLagHours: 24,
      integrationAdapterHint: 'NG_BANK',
      supportsCollection: true,
      supportsDisbursement: true,
    },
    {
      id: 'stripe',
      label: 'Stripe (card)',
      kind: 'card',
      currency: 'NGN',
      minAmountMinorUnits: 10_000,
      settlementLagHours: 48,
      integrationAdapterHint: 'STRIPE',
      supportsCollection: true,
      supportsDisbursement: false,
    },
  ]),
  leaseLaw: buildLeaseLawPort({
    requiredClauses: [
      {
        id: 'ng-parties',
        label: 'Parties (landlord + tenant, full legal names, addresses)',
        mandatory: true,
        citation: 'Recovery of Premises Act Cap. R10 LFN 2004 §3.',
      },
      {
        id: 'ng-premises',
        label: 'Description of premises (plot, block, LGA, state)',
        mandatory: true,
        citation: 'Land Use Act Cap. L5 LFN 2004 §22.',
      },
      {
        id: 'ng-rent',
        label: 'Rent amount and payment frequency, denominated in NGN',
        mandatory: true,
        citation: 'Lagos State Tenancy Law 2011 §6.',
      },
      {
        id: 'ng-firs-tin',
        label: 'Landlord FIRS TIN / NRS Tax ID disclosure',
        mandatory: true,
        citation: 'CITA §81 / PITA §73 (withholding-agent duty); Nigeria Tax Act 2025 §15.',
      },
      {
        id: 'ng-deposit',
        label: 'Deposit / rent-in-advance amount (capped at 6 months in Lagos)',
        mandatory: true,
        citation: 'Lagos State Tenancy Law 2011 §4.',
      },
      {
        id: 'ng-notice',
        label: 'Notice period and termination grounds',
        mandatory: true,
        citation: 'Recovery of Premises Act §7 + Lagos State Tenancy Law §13.',
      },
    ],
    noticeWindowDaysByReason: {
      'non-payment': 7,
      'end-of-term': 180,
      'renewal-non-continuation': 180,
      'landlord-repossession': 180,
      'breach-of-covenant': 30,
      'illegal-use': 7,
      nuisance: 7,
    },
    depositCapByRegime: {
      'residential-standard': {
        maxMonthsOfRent: 6,
        citation: 'Lagos State Tenancy Law 2011 §4 prohibits demanding more than 6 months rent-in-advance from a sitting tenant.',
      },
      commercial: {
        maxMonthsOfRent: 12,
        citation: 'Commercial norm; no statutory cap.',
      },
    },
    rentIncreaseCapByRegime: {
      'residential-standard': {
        citation: 'Lagos State Tenancy Law 2011 §37 — increases must be "reasonable"; disputes go to Magistrate Court (or High Court for rents above NGN 10M).',
      },
      commercial: {
        citation: 'Freely negotiated; subject to lease covenants.',
      },
    },
    defaultNoticeWindowDays: 180,
  }),
  tenantScreening: buildStubScreeningPort('CRB_NG'),
};
