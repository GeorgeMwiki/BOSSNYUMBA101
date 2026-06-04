// TenantRole / TenantUser model the renter/applicant identity the
// tenant-mobile app projects from the Supabase session. The role is an
// app-internal sentinel (never sent to the server — the JWT is canonical
// and parsed FROM the gateway), so it carries the property-domain
// 'tenant' value.
export type TenantRole = 'tenant'
export type LanguageCode = 'sw' | 'en'

export type CountryCode = 'TZ' | 'KE' | 'CD' | 'CN' | 'AE' | 'CH'

export interface TenantUser {
  readonly id: string
  readonly role: TenantRole
  readonly companyName: string
  readonly countryCode: CountryCode
  readonly preferredLang: LanguageCode
  readonly kycStatus: 'pending' | 'submitted' | 'approved' | 'rejected'
  readonly phone: string
}
