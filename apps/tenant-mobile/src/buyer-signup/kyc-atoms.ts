/**
 * KYC atom catalogue for the tenant self-signup wizard.
 *
 * Mirrors the server-side `initialKycAtomsFor()` in the database
 * schema package (the `*-extensions.schema.ts` applicant-extensions
 * source). We intentionally redeclare the values here (instead of
 * importing the database package into the Expo bundle, which would pull
 * Drizzle / Postgres into a mobile build) — the test suite asserts the
 * two lists stay in lock-step.
 *
 * Each atom carries the i18n keys for its title/description plus a
 * `blocking` flag. Blocking atoms gate marketplace applications;
 * non-blocking atoms can be skipped at signup time and completed later.
 */

import type { LanguageCode } from '@/types/auth'
import { translate } from '@/i18n'

export type ApplicantAccountKind = 'individual' | 'business'

export type ApplicantKycAtomKey =
  | 'identity'
  | 'address'
  | 'bank_account'
  | 'source_of_funds'
  | 'company_docs'
  | 'tax_compliance'
  | 'beneficial_owners'
  | 'aml_screening'

export interface ApplicantKycAtomSpec {
  readonly key: ApplicantKycAtomKey
  /** Whether marketplace applications are gated by this atom's completion. */
  readonly blocking: boolean
  /** i18n key for the screen title (e.g. `applicant_signup.kyc.identity.title`). */
  readonly titleKey: string
  /** i18n key for the screen description / instructions. */
  readonly descriptionKey: string
}

const SHARED_INDIVIDUAL: ReadonlyArray<ApplicantKycAtomSpec> = [
  {
    key: 'identity',
    blocking: true,
    titleKey: 'applicant_signup.kyc.identity.title',
    descriptionKey: 'applicant_signup.kyc.identity.description'
  },
  {
    key: 'address',
    blocking: true,
    titleKey: 'applicant_signup.kyc.address.title',
    descriptionKey: 'applicant_signup.kyc.address.description'
  },
  {
    key: 'bank_account',
    blocking: false,
    titleKey: 'applicant_signup.kyc.bank_account.title',
    descriptionKey: 'applicant_signup.kyc.bank_account.description'
  },
  {
    key: 'source_of_funds',
    blocking: true,
    titleKey: 'applicant_signup.kyc.source_of_funds.title',
    descriptionKey: 'applicant_signup.kyc.source_of_funds.description'
  }
]

const SHARED_BUSINESS: ReadonlyArray<ApplicantKycAtomSpec> = [
  {
    key: 'identity',
    blocking: true,
    titleKey: 'applicant_signup.kyc.identity.title',
    descriptionKey: 'applicant_signup.kyc.identity.description'
  },
  {
    key: 'address',
    blocking: true,
    titleKey: 'applicant_signup.kyc.address.title',
    descriptionKey: 'applicant_signup.kyc.address.description'
  },
  {
    key: 'company_docs',
    blocking: true,
    titleKey: 'applicant_signup.kyc.company_docs.title',
    descriptionKey: 'applicant_signup.kyc.company_docs.description'
  },
  {
    key: 'tax_compliance',
    blocking: true,
    titleKey: 'applicant_signup.kyc.tax_compliance.title',
    descriptionKey: 'applicant_signup.kyc.tax_compliance.description'
  },
  {
    key: 'bank_account',
    blocking: false,
    titleKey: 'applicant_signup.kyc.bank_account.title',
    descriptionKey: 'applicant_signup.kyc.bank_account.description'
  },
  {
    key: 'beneficial_owners',
    blocking: true,
    titleKey: 'applicant_signup.kyc.beneficial_owners.title',
    descriptionKey: 'applicant_signup.kyc.beneficial_owners.description'
  },
  {
    key: 'aml_screening',
    blocking: true,
    titleKey: 'applicant_signup.kyc.aml_screening.title',
    descriptionKey: 'applicant_signup.kyc.aml_screening.description'
  }
]

/**
 * Return the ordered atom list for a tenant of the given kind.
 *
 * Returned array is immutable (frozen) — callers compose new arrays
 * rather than mutating the catalogue.
 */
export function atomsFor(
  kind: ApplicantAccountKind
): ReadonlyArray<ApplicantKycAtomSpec> {
  return kind === 'individual' ? SHARED_INDIVIDUAL : SHARED_BUSINESS
}

export function findAtom(
  kind: ApplicantAccountKind,
  key: ApplicantKycAtomKey
): ApplicantKycAtomSpec | undefined {
  return atomsFor(kind).find((a) => a.key === key)
}

export function renderAtomTitle(
  lang: LanguageCode,
  atom: ApplicantKycAtomSpec
): string {
  return translate(lang, atom.titleKey)
}

export function renderAtomDescription(
  lang: LanguageCode,
  atom: ApplicantKycAtomSpec
): string {
  return translate(lang, atom.descriptionKey)
}
