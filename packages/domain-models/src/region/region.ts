/**
 * Region & Language Model — DEPRECATED
 *
 * @deprecated use the jurisdiction registry in
 * `packages/domain-models/src/jurisdiction/` instead.
 *
 * This module remains as a thin compatibility layer because the
 * `Region` / `Language` / `FiscalAuthority` enums are referenced by
 * persisted entity types (`User.region`, `Organization.fiscalCountry`).
 * New code MUST use `getJurisdiction(countryCode)` and friends from
 * the jurisdiction module — adding a new country there is an admin
 * config change rather than an enum extension.
 *
 * The `Region` enum is intentionally limited to TZ / KE / OTHER. To
 * support a 4th country (NG, ZA, etc.) DO NOT add it here — instead
 * register it via `registerJurisdiction()` (or insert a row into the
 * `jurisdiction_configs` table) and migrate callers off the enum.
 */

/**
 * Supported regions. ISO-3166 alpha-2 codes.
 *
 * Add new regions here and then extend `REGION_POLICY` in
 * `packages/enterprise-hardening/src/compliance/region-policy.ts`.
 */
export const Region = {
  TANZANIA: 'TZ',
  KENYA: 'KE',
  /**
   * Catch-all for users / orgs outside the primary jurisdictions.
   * Treated as "no special compliance routing" — falls back to GDPR-
   * style defaults and disables all African fiscal authorities.
   */
  OTHER: 'OTHER',
} as const;

export type Region = (typeof Region)[keyof typeof Region];

/** All region values, for iteration / validation. */
export const ALL_REGIONS: readonly Region[] = Object.values(Region);

/** Type guard for runtime validation of user input. */
export function isRegion(value: unknown): value is Region {
  return typeof value === 'string' && (ALL_REGIONS as readonly string[]).includes(value);
}

/**
 * Coerce a free-form string into a Region or `undefined`. Accepts
 * common synonyms (e.g. "tanzania", "kenya") in any case.
 */
export function parseRegion(value: string | null | undefined): Region | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'TZ' || normalized === 'TANZANIA' || normalized === 'TZA') {
    return Region.TANZANIA;
  }
  if (normalized === 'KE' || normalized === 'KENYA' || normalized === 'KEN') {
    return Region.KENYA;
  }
  if (normalized === 'OTHER') return Region.OTHER;
  return undefined;
}

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------

/**
 * Supported user-interface languages. ISO-639-1 codes.
 *
 * Swahili (`sw`) is the lingua franca for Tanzania and Kenya.
 */
export const Language = {
  ENGLISH: 'en',
  SWAHILI: 'sw',
} as const;

export type Language = (typeof Language)[keyof typeof Language];

export const ALL_LANGUAGES: readonly Language[] = Object.values(Language);

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (ALL_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Default language suggestion for a region. The user can always
 * override at signup or in settings.
 */
export function defaultLanguageForRegion(region: Region): Language {
  switch (region) {
    case Region.TANZANIA:
      return Language.SWAHILI;
    case Region.KENYA:
      return Language.ENGLISH;
    case Region.OTHER:
    default:
      return Language.ENGLISH;
  }
}

// ---------------------------------------------------------------------------
// Fiscal authorities
// ---------------------------------------------------------------------------

/**
 * Tax / fiscal authorities that BOSSNYUMBA integrates with for live
 * invoice posting. The active fiscal authority for an org is determined
 * by its `fiscalCountry`, NOT by the tenant user's region.
 */
export const FiscalAuthority = {
  /** Kenya Revenue Authority — eTIMS OSCU + eRITS MRI */
  KRA: 'KRA',
  /** Tanzania Revenue Authority — VAT + WHT */
  TRA: 'TRA',
  /** No fiscal-authority routing (regions outside TZ/KE) */
  NONE: 'NONE',
} as const;

export type FiscalAuthority = (typeof FiscalAuthority)[keyof typeof FiscalAuthority];

/**
 * Map a fiscal country (region) to the fiscal authority responsible
 * for receiving invoices for that org.
 */
export function fiscalAuthorityForRegion(region: Region): FiscalAuthority {
  switch (region) {
    case Region.KENYA:
      return FiscalAuthority.KRA;
    case Region.TANZANIA:
      return FiscalAuthority.TRA;
    case Region.OTHER:
    default:
      return FiscalAuthority.NONE;
  }
}
