/**
 * Jurisdiction-resolver — real-estate edition.
 *
 * Resolves a tenant's effective jurisdiction snapshot:
 *   - country (ISO-3166 alpha-2)
 *   - countryName (display string)
 *   - currency (ISO-4217)
 *   - defaultLanguage + locale
 *   - timeZone
 *   - rentalHousingAuthority (e.g. RERA-KE, NHC-TZ)
 *   - revenueAuthority (KRA, TRA, URA, FIRS, SARS, ATO)
 *   - dataProtectionAuthority (PDPC-TZ, ODPC-KE, etc.)
 *   - tribunalAuthority (BPRT-KE, RHT-ZA, NCAT-AU, etc.)
 *
 * Per CLAUDE.md hard rule, tenant.jurisdiction is LOCKED at signup
 * (migration 0149-equivalent on BossNyumba). Per-turn / per-session
 * override is handled by the JC-6 switch tool; permanent change is
 * gated by the internal admin four-eye flow.
 *
 * Ported from Borjie — real-estate retailored (mining authorities
 * stripped; rental / housing / revenue / data-protection / tribunal
 * authorities substituted).
 */

export interface RealEstateAuthorities {
  readonly rentalHousingAuthority: string;
  readonly revenueAuthority: string;
  readonly dataProtectionAuthority: string;
  readonly tribunalAuthority: string;
}

export interface ResolvedJurisdiction {
  readonly country: string;
  readonly countryName: string;
  readonly currency: string;
  readonly defaultLanguage: string;
  readonly locale: string;
  readonly timeZone: string;
  readonly authorities: RealEstateAuthorities;
  readonly source: 'tenant' | 'override' | 'unseeded';
}

/**
 * Per-country snapshot — KE-first since BossNyumba's largest market
 * is Kenya, then the EAC + ZA + NG + AU + UK + US fallback.
 */
const SNAPSHOTS: Readonly<Record<string, ResolvedJurisdiction>> = Object.freeze({
  KE: Object.freeze({
    country: 'KE',
    countryName: 'Kenya',
    currency: 'KES',
    defaultLanguage: 'sw',
    locale: 'sw-KE',
    timeZone: 'Africa/Nairobi',
    authorities: Object.freeze({
      rentalHousingAuthority: 'Rental Housing Tribunal Kenya',
      revenueAuthority: 'Kenya Revenue Authority (KRA)',
      dataProtectionAuthority: 'Office of the Data Protection Commissioner (ODPC)',
      tribunalAuthority: 'Business Premises Rent Tribunal (BPRT)',
    }),
    source: 'tenant',
  }),
  TZ: Object.freeze({
    country: 'TZ',
    countryName: 'Tanzania',
    currency: 'TZS',
    defaultLanguage: 'sw',
    locale: 'sw-TZ',
    timeZone: 'Africa/Dar_es_Salaam',
    authorities: Object.freeze({
      rentalHousingAuthority: 'Ministry of Lands, Housing and Human Settlements Development',
      revenueAuthority: 'Tanzania Revenue Authority (TRA)',
      dataProtectionAuthority: 'Personal Data Protection Commission (PDPC)',
      tribunalAuthority: 'Rent Restriction Board',
    }),
    source: 'tenant',
  }),
  UG: Object.freeze({
    country: 'UG',
    countryName: 'Uganda',
    currency: 'UGX',
    defaultLanguage: 'en',
    locale: 'en-UG',
    timeZone: 'Africa/Kampala',
    authorities: Object.freeze({
      rentalHousingAuthority: 'Ministry of Lands, Housing and Urban Development',
      revenueAuthority: 'Uganda Revenue Authority (URA)',
      dataProtectionAuthority: 'Personal Data Protection Office (PDPO)',
      tribunalAuthority: 'Magistrate Courts (small-claims)',
    }),
    source: 'tenant',
  }),
  NG: Object.freeze({
    country: 'NG',
    countryName: 'Nigeria',
    currency: 'NGN',
    defaultLanguage: 'en',
    locale: 'en-NG',
    timeZone: 'Africa/Lagos',
    authorities: Object.freeze({
      rentalHousingAuthority: 'Federal Ministry of Housing and Urban Development',
      revenueAuthority: 'Federal Inland Revenue Service (FIRS) / LIRS (Lagos)',
      dataProtectionAuthority: 'Nigeria Data Protection Commission (NDPC)',
      tribunalAuthority: 'Tenancy Tribunal (state-specific)',
    }),
    source: 'tenant',
  }),
  ZA: Object.freeze({
    country: 'ZA',
    countryName: 'South Africa',
    currency: 'ZAR',
    defaultLanguage: 'en',
    locale: 'en-ZA',
    timeZone: 'Africa/Johannesburg',
    authorities: Object.freeze({
      rentalHousingAuthority: 'National Department of Human Settlements',
      revenueAuthority: 'South African Revenue Service (SARS)',
      dataProtectionAuthority: 'Information Regulator (POPIA)',
      tribunalAuthority: 'Rental Housing Tribunal (province-specific)',
    }),
    source: 'tenant',
  }),
  AU: Object.freeze({
    country: 'AU',
    countryName: 'Australia',
    currency: 'AUD',
    defaultLanguage: 'en',
    locale: 'en-AU',
    timeZone: 'Australia/Sydney',
    authorities: Object.freeze({
      rentalHousingAuthority: 'State residential tenancy authority (CAV / NSW Fair Trading / RTA QLD)',
      revenueAuthority: 'Australian Taxation Office (ATO)',
      dataProtectionAuthority: 'Office of the Australian Information Commissioner (OAIC)',
      tribunalAuthority: 'NCAT / VCAT / QCAT (state-specific)',
    }),
    source: 'tenant',
  }),
  UK: Object.freeze({
    country: 'UK',
    countryName: 'United Kingdom',
    currency: 'GBP',
    defaultLanguage: 'en',
    locale: 'en-GB',
    timeZone: 'Europe/London',
    authorities: Object.freeze({
      rentalHousingAuthority: 'Ministry of Housing, Communities and Local Government',
      revenueAuthority: 'HM Revenue and Customs (HMRC)',
      dataProtectionAuthority: "Information Commissioner's Office (ICO)",
      tribunalAuthority: 'First-tier Tribunal (Property Chamber)',
    }),
    source: 'tenant',
  }),
  US: Object.freeze({
    country: 'US',
    countryName: 'United States',
    currency: 'USD',
    defaultLanguage: 'en',
    locale: 'en-US',
    timeZone: 'America/New_York',
    authorities: Object.freeze({
      rentalHousingAuthority: 'Department of Housing and Urban Development (HUD)',
      revenueAuthority: 'Internal Revenue Service (IRS)',
      dataProtectionAuthority: 'State Attorney General offices (no federal regulator)',
      tribunalAuthority: 'State / county landlord-tenant courts',
    }),
    source: 'tenant',
  }),
});

const UNSEEDED_SNAPSHOT: ResolvedJurisdiction = Object.freeze({
  country: 'XX',
  countryName: 'Unseeded',
  currency: 'USD',
  defaultLanguage: 'en',
  locale: 'en-US',
  timeZone: 'UTC',
  authorities: Object.freeze({
    rentalHousingAuthority: 'Not yet seeded — falling back to advisory mode',
    revenueAuthority: 'Not yet seeded — falling back to advisory mode',
    dataProtectionAuthority: 'Not yet seeded — falling back to advisory mode',
    tribunalAuthority: 'Not yet seeded — falling back to advisory mode',
  }),
  source: 'unseeded',
});

export interface TenantConfigPort {
  /**
   * Lookup the tenant's locked-at-signup country code (ISO-3166 alpha-2).
   * Returns `undefined` for an unseeded / brand-new tenant.
   */
  getTenantCountry(tenantId: string): Promise<string | undefined>;
  /**
   * Read the active per-session jurisdiction override (set via the
   * JC-6 switch tool). Returns `undefined` when no override is active.
   */
  getSessionOverride?(tenantId: string, sessionId: string): Promise<string | undefined>;
}

export interface JurisdictionResolverArgs {
  readonly tenantConfig: TenantConfigPort;
}

export interface JurisdictionResolver {
  resolve(tenantId: string, sessionId?: string): Promise<ResolvedJurisdiction>;
  snapshotFor(country: string): ResolvedJurisdiction;
  listSupportedCountries(): ReadonlyArray<string>;
}

export function createJurisdictionResolver(
  args: JurisdictionResolverArgs,
): JurisdictionResolver {
  return {
    async resolve(tenantId: string, sessionId?: string) {
      // Session override wins (JC-6 turn / session scope).
      if (sessionId && args.tenantConfig.getSessionOverride) {
        const override = await args.tenantConfig.getSessionOverride(
          tenantId,
          sessionId,
        );
        if (override) {
          const snap = SNAPSHOTS[override.toUpperCase()];
          if (snap) {
            return Object.freeze({ ...snap, source: 'override' as const });
          }
        }
      }
      const country = await args.tenantConfig.getTenantCountry(tenantId);
      if (!country) return UNSEEDED_SNAPSHOT;
      const snap = SNAPSHOTS[country.toUpperCase()];
      return snap ?? UNSEEDED_SNAPSHOT;
    },
    snapshotFor(country: string) {
      const snap = SNAPSHOTS[country.toUpperCase()];
      return snap ?? UNSEEDED_SNAPSHOT;
    },
    listSupportedCountries() {
      return Object.freeze(Object.keys(SNAPSHOTS));
    },
  };
}
