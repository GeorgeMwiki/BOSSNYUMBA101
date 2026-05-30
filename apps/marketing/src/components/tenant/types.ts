/**
 * Wire-level types for the marketing tenant signup wizard.
 *
 * These mirror the discriminated union accepted by
 * `services/api-gateway/src/routes/tenants/signup.hono.ts`
 * (see `TenantSignupRequestSchema`). The marketing site holds
 * draft state in this same shape so it can be POSTed verbatim
 * after a single client-side zod parse.
 *
 * We pin the constant tuples here instead of importing from
 * `@bossnyumba/database` because the marketing app is intentionally
 * decoupled from the database package (it never queries Drizzle).
 */

export const TENANT_COUNTRY_CODES = [
  'TZ',
  'KE',
  'UG',
  'RW',
  'NG',
  'ZA',
  'AE',
  'EU',
  'OTHER',
] as const;
export type TenantCountryCode = (typeof TENANT_COUNTRY_CODES)[number];

export const TENANT_CURRENCY_CODES = [
  'TZS',
  'KES',
  'UGX',
  'USD',
  'EUR',
] as const;
export type TenantCurrencyCode = (typeof TENANT_CURRENCY_CODES)[number];

export const TENANT_LANGUAGE_CODES = ['sw', 'en'] as const;
export type TenantLanguageCode = (typeof TENANT_LANGUAGE_CODES)[number];

/**
 * Real-estate-specific business types: companies leasing on behalf of
 * staff (corporate lets), serviced-apartment operators, embassies,
 * NGOs holding long leases, and a catch-all "other" for anything not
 * captured by the four shipped kinds.
 */
export const TENANT_BUSINESS_KINDS = [
  'corporate-let',
  'serviced-apartment',
  'embassy-or-ngo',
  'institutional',
  'other',
] as const;
export type TenantBusinessKind = (typeof TENANT_BUSINESS_KINDS)[number];

export type TenantAccountKind = 'individual' | 'business';

export interface IndividualTenantDraft {
  readonly kind: 'individual';
  readonly country: TenantCountryCode;
  readonly fullName: string;
  readonly phoneE164: string;
  readonly email: string;
  readonly preferredCurrency: TenantCurrencyCode;
  readonly preferredLanguage: TenantLanguageCode;
  readonly nationalIdNumber: string;
}

export interface CorporateTenantDraft {
  readonly kind: 'business';
  readonly country: TenantCountryCode;
  readonly orgName: string;
  readonly businessKind: TenantBusinessKind;
  readonly businessRegistrationNumber: string;
  readonly taxId: string;
  readonly contactFullName: string;
  readonly contactPhoneE164: string;
  readonly contactEmail: string;
  readonly preferredCurrency: TenantCurrencyCode;
  readonly preferredLanguage: TenantLanguageCode;
}

export type TenantSignupDraft = IndividualTenantDraft | CorporateTenantDraft;

/**
 * Server response shape on the happy path (201). Matches the JSON
 * payload returned by the api-gateway tenant signup handler.
 */
export interface TenantSignupSuccess {
  readonly tenantOrgId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly kind: TenantAccountKind;
  readonly otpRequired: boolean;
  readonly signupStatus: 'pending_otp_verification';
}

/** Error response shape on 4xx / 5xx. */
export interface TenantSignupError {
  readonly error: string;
  readonly message?: string;
  readonly issues?: ReadonlyArray<{
    readonly path: string;
    readonly code: string;
    readonly message: string;
  }>;
}
