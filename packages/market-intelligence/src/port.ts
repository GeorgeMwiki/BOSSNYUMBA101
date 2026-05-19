/**
 * MarketDataPort — single-port interface that operators plug
 * external market-data sources (Zillow, Airbnb, Rentometer, regional
 * comparable-rent feeds, …) behind.
 *
 * Distinct from the existing `ExternalFeedAdapter` (district-level
 * aggregate metrics consumed by `MarketDataService`). This port is
 * per-query: a kernel tool asks for "comparable rents in TZ-DAR for a
 * 2BR over the last 90 days" and gets back a list of comparables, or
 * a structured "unconfigured" outcome if the operator hasn't supplied
 * an API key for the provider.
 *
 * Outcomes — never throw across the port:
 *   - `ok`              successful fetch (or cache hit). Carries data
 *                       + a `cached` flag + the source `fetchedAt`.
 *   - `unconfigured`    no API key — adapter is wired but inactive.
 *                       UX hint tells the operator how to enable it.
 *   - `error`           transient or schema failure. Carries a short
 *                       message; the calling kernel tool may decide
 *                       to retry, surface, or quietly skip.
 *
 * Privacy:
 *   - Comparable rents NEVER carry the full address. Adapters
 *     hash/fingerprint the address (or its identifier) into
 *     `addressFingerprint`. Operators stay GDPR-friendly even if the
 *     upstream provides PII.
 *
 * Tenant-isolation: NOT relevant here. This is platform-tier external
 * data — the same Zillow result is reusable across every tenant
 * asking the same question. The cache layer reflects that.
 */

// ─────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────

export interface ComparableRentsArgs {
  /** Free-form jurisdiction code, e.g. 'TZ-DAR-ES-SALAAM', 'KE-NAIROBI'. */
  readonly jurisdiction: string;
  /** Free-form class, e.g. 'residential-2br', 'commercial-office'. */
  readonly propertyClass: string;
  /** Optional bedroom filter; ignored when undefined. */
  readonly bedrooms?: number;
  /** Optional square-footage filter; ignored when undefined. */
  readonly squareFeet?: number;
  /** Recency filter — only consider observations within the last N days. */
  readonly windowDays: number;
  /**
   * Tenant scope for cache key segregation (H19 closure).
   *
   * Round-3 audit: the previous cache key combined
   * `provider | op | query` only. Two tenants with the same
   * district + class + bedrooms query received identical cache hits
   * across the SHARED platform-tier cache store. Adding tenantId to
   * the query envelope produces per-tenant cache segments — same
   * jurisdiction query from two different tenants now keys to two
   * distinct cache rows.
   *
   * The market data ITSELF is still platform-tier (Airbnb's view of
   * Nairobi 2BR rents doesn't change per BOSSNYUMBA tenant). The
   * cache segmentation is a defence against future tenant-personalised
   * adapter behaviour (e.g. per-tenant API tier / discount applied
   * to upstream calls).
   */
  readonly tenantId?: string;
}

export interface VacancyTrendArgs {
  readonly jurisdiction: string;
  readonly propertyClass: string;
  readonly windowDays: number;
  /** Tenant scope for cache key segregation — see ComparableRentsArgs.tenantId. */
  readonly tenantId?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────

export interface ComparableRent {
  /** Rent in major units (e.g. 1500 means $1,500 when currency = 'USD'). */
  readonly rentMajor: number;
  /** ISO-4217 currency code. */
  readonly currency: string;
  readonly bedrooms: number;
  /** May be null when the source did not surface a square-foot estimate. */
  readonly squareFeet: number | null;
  /**
   * Stable per-listing fingerprint — never the full address. Adapters
   * hash the address (or upstream listing id) before populating this.
   */
  readonly addressFingerprint: string;
  readonly observedAt: string;
}

export interface VacancyTrend {
  readonly meanDaysVacant: number;
  readonly p50DaysVacant: number;
  readonly p90DaysVacant: number;
  readonly sampleSize: number;
  readonly observedAt: string;
}

// ─────────────────────────────────────────────────────────────────────
// Outcome envelope
// ─────────────────────────────────────────────────────────────────────

export type MarketDataOutcome<T> =
  | {
      readonly kind: 'ok';
      readonly data: T;
      readonly cached: boolean;
      readonly fetchedAt: string;
    }
  | {
      readonly kind: 'unconfigured';
      readonly provider: string;
      readonly hint: string;
    }
  | {
      readonly kind: 'error';
      readonly provider: string;
      readonly message: string;
    };

// ─────────────────────────────────────────────────────────────────────
// Port
// ─────────────────────────────────────────────────────────────────────

export interface MarketDataPort {
  /** Stable provider identifier — 'zillow' | 'airbnb' | etc. */
  readonly provider: string;
  fetchComparableRents(
    args: ComparableRentsArgs,
  ): Promise<MarketDataOutcome<ReadonlyArray<ComparableRent>>>;
  fetchVacancyTrends(
    args: VacancyTrendArgs,
  ): Promise<MarketDataOutcome<VacancyTrend>>;
}

// ─────────────────────────────────────────────────────────────────────
// Cache — duck-typed locally so this package does not compile-time-
// depend on @bossnyumba/database. The api-gateway composition root
// wires a concrete implementation in.
// ─────────────────────────────────────────────────────────────────────

export interface MarketDataCacheServiceShape {
  get(cacheKey: string): Promise<{
    readonly resultJson: unknown;
    readonly fetchedAt: string;
  } | null>;
  put(
    cacheKey: string,
    provider: string,
    queryJson: unknown,
    resultJson: unknown,
    ttlMs: number,
  ): Promise<void>;
}
