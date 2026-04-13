/**
 * Jurisdiction Configuration Model
 *
 * BOSSNYUMBA is a GLOBAL SaaS platform, starting with Tanzania.
 * Jurisdictions are NOT hardcoded — they are database-driven
 * configurations that an admin can extend by inserting rows, not
 * editing code.
 *
 * A "jurisdiction" is an ISO-3166 alpha-2 country code (e.g., 'TZ',
 * 'KE', 'NG', 'ZA', 'AE', 'GB', 'US') plus the full set of rules
 * that country needs: tax rates, fiscal authority, privacy law,
 * languages, allowed subprocessors, invoice template, currency, etc.
 *
 * DESIGN PRINCIPLES:
 *   1. NO hardcoded country checks in application code.
 *      Never write `if (country === 'TZ')`. Instead, read the config.
 *   2. Adding a new country = inserting a JurisdictionConfig row.
 *   3. Tax rates, compliance rules, and language lists are all
 *      part of the config — not constants.
 *   4. AI-driven intelligence can override or augment config values
 *      via the `overrides` field (continuous learning, not static).
 *   5. The system falls back to a sensible global default for
 *      any jurisdiction that hasn't been explicitly configured.
 */

// ---------------------------------------------------------------------------
// Core jurisdiction types
// ---------------------------------------------------------------------------

/**
 * ISO-3166 alpha-2 country code. NOT an enum — any valid 2-letter
 * code is accepted. New countries don't require code changes.
 */
export type CountryCode = string;

/**
 * ISO-639-1 language code. NOT an enum — any valid 2-letter code
 * is accepted. New languages don't require code changes.
 */
export type LanguageCode = string;

/**
 * ISO-4217 currency code.
 */
export type CurrencyCode = string;

/**
 * Tax rate entry. Rates are decimal fractions (0.18 = 18%).
 * Each jurisdiction can define N tax types with configurable rates.
 */
export interface TaxRateConfig {
  /** Machine key (e.g., 'vat', 'wht_resident', 'wht_nonresident', 'mri', 'stamp_duty') */
  readonly key: string;
  /** Human-readable label (e.g., 'Value Added Tax') */
  readonly label: string;
  /** Rate as decimal fraction */
  readonly rate: number;
  /** Whether this tax applies to residential rent */
  readonly appliesToResidential: boolean;
  /** Whether this tax applies to commercial rent */
  readonly appliesToCommercial: boolean;
  /** Whether this rate can be overridden by AI/admin per-property */
  readonly overridable: boolean;
  /** Optional notes (e.g., 'Post-Jan-2024 rate, verify with KRA') */
  readonly notes?: string;
  /** Effective date range */
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
}

/**
 * Fiscal authority configuration. Describes how invoices are
 * submitted to the country's tax authority.
 */
export interface FiscalAuthorityConfig {
  /** Machine key (e.g., 'kra', 'tra', 'firs', 'sars', 'hmrc') */
  readonly key: string;
  /** Human-readable name (e.g., 'Kenya Revenue Authority') */
  readonly name: string;
  /** Base API URL for the authority's integration */
  readonly apiBaseUrl: string;
  /** Authentication method ('hmac', 'oauth2', 'api_key', 'certificate') */
  readonly authMethod: string;
  /** Whether invoices MUST be submitted before being marked authoritative */
  readonly requiresPreAuthSubmission: boolean;
  /** Invoice types that trigger submission (e.g., ['RENT', 'UTILITY', 'MAINTENANCE']) */
  readonly triggeringInvoiceTypes: readonly string[];
  /** ENV var prefix for credentials (e.g., 'KRA_ETIMS' → reads KRA_ETIMS_API_URL, KRA_ETIMS_PIN, etc.) */
  readonly envPrefix: string;
  /** Whether this authority is currently active (can be disabled without removing config) */
  readonly active: boolean;
}

/**
 * Privacy/compliance configuration for a jurisdiction.
 */
export interface ComplianceConfig {
  /** Name of the data protection law (e.g., 'Tanzania PDPA 2022', 'Kenya DPA 2019', 'GDPR') */
  readonly dataProtectionLaw: string;
  /** Whether explicit cookie consent is required */
  readonly requiresExplicitCookieConsent: boolean;
  /** Subprocessor IDs that are blocked for users in this jurisdiction */
  readonly blockedSubprocessors: readonly string[];
  /** Data residency requirement (e.g., 'eu_only', 'in_region', 'any') */
  readonly dataResidency: string;
  /** Maximum data retention period in days (0 = no limit) */
  readonly maxRetentionDays: number;
  /** Whether the jurisdiction requires a DPO appointment */
  readonly requiresDpo: boolean;
  /** Whether cross-border data transfers require explicit consent */
  readonly crossBorderTransferRequiresConsent: boolean;
}

/**
 * The complete jurisdiction configuration. This is what gets stored
 * in the `jurisdiction_configs` database table and cached in-memory.
 *
 * Adding a new country = inserting a row with this shape.
 * No code changes required.
 */
export interface JurisdictionConfig {
  /** ISO-3166 alpha-2 country code (primary key) */
  readonly countryCode: CountryCode;
  /** Human-readable country name */
  readonly countryName: string;
  /** Default currency for this jurisdiction */
  readonly defaultCurrency: CurrencyCode;
  /** Available languages, ordered by preference */
  readonly languages: readonly LanguageCode[];
  /** Default language for new users in this jurisdiction */
  readonly defaultLanguage: LanguageCode;
  /** Timezone (IANA, e.g., 'Africa/Dar_es_Salaam') */
  readonly timezone: string;
  /** Phone country code (e.g., '+255', '+254') */
  readonly phonePrefix: string;

  // Tax configuration
  readonly taxRates: readonly TaxRateConfig[];
  readonly fiscalAuthority: FiscalAuthorityConfig | null;

  // Compliance
  readonly compliance: ComplianceConfig;

  // Invoice template
  readonly invoiceTemplateId: string;

  // Privacy docs
  readonly privacyDocId: string;
  readonly termsDocId: string;

  // AI/ML overrides (continuously learned, not static)
  readonly aiOverrides?: {
    /** AI-suggested market rent adjustments per property type */
    readonly marketRentModels?: Record<string, string>;
    /** AI-learned optimal reminder timing for this jurisdiction */
    readonly optimalReminderDays?: readonly number[];
    /** AI-detected seasonal vacancy patterns */
    readonly vacancySeasonality?: Record<string, number>;
  };

  // Metadata
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// Global default (used when a jurisdiction hasn't been configured)
// ---------------------------------------------------------------------------

/**
 * Sensible global default. Any country that hasn't been explicitly
 * configured falls back to this. It's conservative: GDPR-style
 * compliance, no fiscal authority, USD currency.
 */
export const GLOBAL_DEFAULT_JURISDICTION: Omit<JurisdictionConfig, 'countryCode' | 'countryName'> = {
  defaultCurrency: 'USD',
  languages: ['en'],
  defaultLanguage: 'en',
  timezone: 'UTC',
  phonePrefix: '+1',
  taxRates: [],
  fiscalAuthority: null,
  compliance: {
    dataProtectionLaw: 'GDPR (EU 2016/679) — applied as global default',
    requiresExplicitCookieConsent: true,
    blockedSubprocessors: [],
    dataResidency: 'any',
    maxRetentionDays: 0,
    requiresDpo: false,
    crossBorderTransferRequiresConsent: true,
  },
  invoiceTemplateId: 'global-default',
  privacyDocId: 'global-privacy',
  termsDocId: 'global-tos',
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Jurisdiction registry (in-memory cache, populated from DB)
// ---------------------------------------------------------------------------

/**
 * The jurisdiction registry. In production this is populated from the
 * `jurisdiction_configs` database table at service boot. For tests
 * and development, seed data provides the initial jurisdictions.
 *
 * The registry is a simple Map so lookups are O(1). It's refreshed
 * periodically (configurable interval) to pick up admin changes
 * without requiring a redeploy.
 */
const registry = new Map<CountryCode, JurisdictionConfig>();

/**
 * Register a jurisdiction configuration. Called at boot from the
 * DB seed loader, and on-demand when an admin adds/updates a
 * jurisdiction via the admin portal.
 */
export function registerJurisdiction(config: JurisdictionConfig): void {
  registry.set(config.countryCode.toUpperCase(), config);
}

/**
 * Get the configuration for a jurisdiction. Returns the global
 * default (merged with the country code) if not explicitly configured.
 * NEVER returns null — every country has at least the default config.
 */
export function getJurisdiction(countryCode: CountryCode | null | undefined): JurisdictionConfig {
  if (!countryCode) {
    return { ...GLOBAL_DEFAULT_JURISDICTION, countryCode: 'GLOBAL', countryName: 'Global Default' };
  }
  const normalized = countryCode.trim().toUpperCase();
  const config = registry.get(normalized);
  if (config) return config;
  // Not configured — return global default with this country code
  return { ...GLOBAL_DEFAULT_JURISDICTION, countryCode: normalized, countryName: normalized };
}

/**
 * Get all registered jurisdictions (for admin listing).
 */
export function getAllJurisdictions(): JurisdictionConfig[] {
  return Array.from(registry.values());
}

/**
 * Check if a jurisdiction has been explicitly configured.
 */
export function isJurisdictionConfigured(countryCode: CountryCode): boolean {
  return registry.has(countryCode.trim().toUpperCase());
}

/**
 * Clear the registry (for tests).
 */
export function clearJurisdictionRegistry(): void {
  registry.clear();
}

// ---------------------------------------------------------------------------
// Convenience accessors (replace hardcoded checks)
// ---------------------------------------------------------------------------

/**
 * Get the tax rate for a specific tax type in a jurisdiction.
 * Returns 0 if not configured (instead of throwing).
 */
export function getTaxRate(
  countryCode: CountryCode,
  taxKey: string,
  opts?: { isCommercial?: boolean },
): number {
  const config = getJurisdiction(countryCode);
  const tax = config.taxRates.find((t) => {
    if (t.key !== taxKey) return false;
    if (opts?.isCommercial !== undefined) {
      return opts.isCommercial ? t.appliesToCommercial : t.appliesToResidential;
    }
    return true;
  });
  return tax?.rate ?? 0;
}

/**
 * Check if a subprocessor is blocked for a user's jurisdiction.
 * Replaces the hardcoded DEEPSEEK_BLOCKED_COUNTRIES array.
 */
export function isSubprocessorBlocked(
  countryCode: CountryCode,
  subprocessorId: string,
): boolean {
  const config = getJurisdiction(countryCode);
  return config.compliance.blockedSubprocessors.includes(subprocessorId);
}

/**
 * Check if invoices require fiscal authority submission before
 * being marked authoritative.
 */
export function requiresFiscalSubmission(
  countryCode: CountryCode,
  invoiceType: string,
): boolean {
  const config = getJurisdiction(countryCode);
  if (!config.fiscalAuthority?.active) return false;
  if (!config.fiscalAuthority.requiresPreAuthSubmission) return false;
  return config.fiscalAuthority.triggeringInvoiceTypes.includes(invoiceType);
}
