/**
 * Region Policy Bundle
 *
 * Single source of truth that maps a `Region` (TZ / KE / OTHER) to a
 * complete bundle of policy + compliance + UX rules. ALL application
 * code that needs to make a region-dependent decision SHOULD import
 * this bundle rather than hard-coding region literals.
 *
 * Two flavors of bundle:
 *
 * 1. **User region policy** — `getUserPolicy(region)`. Drives PII /
 *    privacy rules that follow the data subject (the human user):
 *    Privacy Policy / ToS document, allowed LLM subprocessors,
 *    cookie/consent behavior, default UI language.
 *
 * 2. **Org fiscal policy** — `getOrgFiscalPolicy(region)`. Drives the
 *    landlord-side fiscal authority routing: which tax authority
 *    receives invoices, default tax rates for VAT/WHT/MRI, invoice
 *    template flavor.
 *
 * Why two: a TZ user can rent from a KE landlord. The user's PII
 * routes by `getUserPolicy('TZ')` (Tanzania PDPA, no DeepSeek). The
 * rent invoice routes by `getOrgFiscalPolicy('KE')` (KRA eTIMS).
 */

import {
  Region,
  Language,
  FiscalAuthority,
  defaultLanguageForRegion,
  fiscalAuthorityForRegion,
} from '@bossnyumba/domain-models';

// ---------------------------------------------------------------------------
// User region policy (PII / privacy / language)
// ---------------------------------------------------------------------------

/**
 * The set of LLM subprocessors that can NEVER be used to process this
 * region's user data. Application code (e.g.
 * `packages/ai-copilot/src/llm-provider-gate.ts`) MUST honor this list.
 */
export interface UserRegionPolicy {
  /** Region this policy applies to. */
  readonly region: Region;
  /** Default UI language suggestion. User can override. */
  readonly defaultLanguage: Language;
  /** Languages offered in the picker for users in this region. */
  readonly availableLanguages: readonly Language[];
  /**
   * Stable identifier of the Privacy Policy document version. The
   * customer-app + estate-manager-app + bossnyumba_app render the doc
   * at this id from `Docs/legal/{region}/privacy-{id}.md` (or wherever
   * the legal team chooses to host it).
   */
  readonly privacyDocId: string;
  /** Stable identifier of the Terms-of-Service document version. */
  readonly termsDocId: string;
  /**
   * Subprocessor ids that MUST NOT receive PII for users in this region.
   * Cross-references `packages/enterprise-hardening/src/compliance/subprocessors.ts`.
   */
  readonly blockedSubprocessors: readonly string[];
  /**
   * Whether the user must explicitly opt in to non-essential cookies.
   * GDPR-style consent (TZ + KE both require this).
   */
  readonly requiresExplicitCookieConsent: boolean;
  /**
   * Statutory data-protection law that applies to PII for users in
   * this region. Used for compliance audits and data-subject-rights
   * (DSR) responses.
   */
  readonly dataProtectionLaw: string;
}

const USER_POLICIES: Readonly<Record<Region, UserRegionPolicy>> = {
  [Region.TANZANIA]: {
    region: Region.TANZANIA,
    defaultLanguage: Language.SWAHILI,
    availableLanguages: [Language.SWAHILI, Language.ENGLISH],
    privacyDocId: 'tz-pdpa-2026-04',
    termsDocId: 'tz-tos-2026-04',
    blockedSubprocessors: ['deepseek'],
    requiresExplicitCookieConsent: true,
    dataProtectionLaw: 'Tanzania Personal Data Protection Act, 2022 (PDPA)',
  },
  [Region.KENYA]: {
    region: Region.KENYA,
    defaultLanguage: Language.ENGLISH,
    availableLanguages: [Language.ENGLISH, Language.SWAHILI],
    privacyDocId: 'ke-dpa-2026-04',
    termsDocId: 'ke-tos-2026-04',
    blockedSubprocessors: ['deepseek'],
    requiresExplicitCookieConsent: true,
    dataProtectionLaw: 'Kenya Data Protection Act, 2019',
  },
  [Region.OTHER]: {
    region: Region.OTHER,
    defaultLanguage: Language.ENGLISH,
    availableLanguages: [Language.ENGLISH, Language.SWAHILI],
    privacyDocId: 'global-2026-04',
    termsDocId: 'global-tos-2026-04',
    blockedSubprocessors: [],
    requiresExplicitCookieConsent: true,
    dataProtectionLaw: 'GDPR (EU 2016/679) — default for non-TZ/KE jurisdictions',
  },
};

/**
 * Returns the full user-region policy bundle. Always returns a value
 * (falls back to OTHER if the region is unknown).
 */
export function getUserPolicy(region: Region | undefined | null): UserRegionPolicy {
  if (!region) return USER_POLICIES[Region.OTHER];
  return USER_POLICIES[region] ?? USER_POLICIES[Region.OTHER];
}

/**
 * Convenience: returns true if the named subprocessor is blocked for
 * the given region.
 */
export function isSubprocessorBlockedForRegion(
  subprocessorId: string,
  region: Region | undefined | null,
): boolean {
  return getUserPolicy(region).blockedSubprocessors.includes(subprocessorId);
}

// ---------------------------------------------------------------------------
// Org fiscal policy (tax authority + rates + invoice templates)
// ---------------------------------------------------------------------------

/**
 * Tax-rate bundle. Rates are stored as decimal fractions (0.18 = 18%).
 * Use the helpers in `services/tax-compliance/src/engine/tax-calculator.ts`
 * to apply them rather than multiplying ad-hoc.
 */
export interface TaxRates {
  /** Standard VAT rate on commercial rent + services. */
  readonly vat: number;
  /**
   * Withholding tax rate on rent paid to resident landlords (TZ-specific
   * convention; KE handles via different mechanism — see `mri`).
   */
  readonly whtRentResident: number;
  /** Withholding tax rate on rent paid to non-resident landlords. */
  readonly whtRentNonResident: number;
  /**
   * Monthly Rental Income tax rate (KE-specific). TZ does not use MRI.
   *
   * KE rate is currently disputed in prior research: pre-2024 was 10%,
   * post-Jan-2024 was reduced to 7.5% — DO confirm with KRA before
   * production use. The default here is the post-2024 7.5% rate; the
   * tax-compliance engine exposes a `MRI_RATE_OVERRIDE` env var.
   */
  readonly mri: number | null;
}

export interface OrgFiscalPolicy {
  readonly fiscalCountry: Region;
  readonly fiscalAuthority: FiscalAuthority;
  /** Currency code expected on invoices. ISO-4217. */
  readonly defaultCurrency: string;
  /**
   * Identifier of the invoice-template variant to render. The PDF
   * pipeline renders different fields per variant (KE eTIMS QR + receipt
   * number, TZ TRA TIN + EFD signature, etc.).
   */
  readonly invoiceTemplateId: string;
  readonly taxRates: TaxRates;
  /**
   * If true, invoices for triggering types MUST be posted to the
   * fiscal authority before being marked authoritative
   * (PENDING_TAX_SUBMISSION on failure). See
   * `services/payments-ledger/src/services/invoice.generator.ts`.
   */
  readonly requiresFiscalSubmissionBeforeAuthoritative: boolean;
}

const FISCAL_POLICIES: Readonly<Record<Region, OrgFiscalPolicy>> = {
  [Region.TANZANIA]: {
    fiscalCountry: Region.TANZANIA,
    fiscalAuthority: FiscalAuthority.TRA,
    defaultCurrency: 'TZS',
    invoiceTemplateId: 'tz-tra-2026-04',
    taxRates: {
      vat: 0.18,
      whtRentResident: 0.10,
      whtRentNonResident: 0.15,
      mri: null,
    },
    requiresFiscalSubmissionBeforeAuthoritative: true,
  },
  [Region.KENYA]: {
    fiscalCountry: Region.KENYA,
    fiscalAuthority: FiscalAuthority.KRA,
    defaultCurrency: 'KES',
    invoiceTemplateId: 'ke-etims-2026-04',
    taxRates: {
      vat: 0.16,
      whtRentResident: 0.10,
      whtRentNonResident: 0.30,
      mri: 0.075,
    },
    requiresFiscalSubmissionBeforeAuthoritative: true,
  },
  [Region.OTHER]: {
    fiscalCountry: Region.OTHER,
    fiscalAuthority: FiscalAuthority.NONE,
    defaultCurrency: 'USD',
    invoiceTemplateId: 'global-2026-04',
    taxRates: {
      vat: 0,
      whtRentResident: 0,
      whtRentNonResident: 0,
      mri: null,
    },
    requiresFiscalSubmissionBeforeAuthoritative: false,
  },
};

/**
 * Returns the full org fiscal-policy bundle. Always returns a value
 * (falls back to OTHER if the region is unknown).
 */
export function getOrgFiscalPolicy(
  fiscalCountry: Region | undefined | null,
): OrgFiscalPolicy {
  if (!fiscalCountry) return FISCAL_POLICIES[Region.OTHER];
  return FISCAL_POLICIES[fiscalCountry] ?? FISCAL_POLICIES[Region.OTHER];
}

/**
 * Convenience: returns true if invoices for the given org's fiscal
 * country must be posted to the fiscal authority before being marked
 * authoritative.
 */
export function requiresFiscalSubmission(
  fiscalCountry: Region | undefined | null,
): boolean {
  return getOrgFiscalPolicy(fiscalCountry).requiresFiscalSubmissionBeforeAuthoritative;
}
