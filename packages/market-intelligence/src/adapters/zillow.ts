/**
 * Zillow MarketDataPort adapter.
 *
 * Production wiring is gated behind `config.apiKey` (the api-gateway
 * composition root passes `process.env.ZILLOW_API_KEY`). When the key
 * is absent every call resolves to `{ kind: 'unconfigured' }` — the
 * adapter never throws, and the kernel tool downstream renders a
 * friendly hint to the operator.
 *
 * The actual upstream HTTP call is left as a TODO. Until a real
 * Zillow endpoint integration lands, callers can supply a custom
 * `fetch` impl that honours the `X-MOCK-MARKET-DATA: zillow` header
 * to deliver a deterministic, typed mock — useful for tests and for
 * local demos that need plausible numbers without API credentials.
 *
 * Caching:
 *   - `cacheKey` is sha256(provider | normalised query JSON).
 *   - On cache hit (TTL not elapsed) the upstream is NOT called and
 *     the outcome is `{ kind: 'ok', cached: true, ... }`.
 *   - On cache miss the upstream is called; on `ok` the result is
 *     persisted via `cache.put(...)` for `cacheTtlMs` (default 1h).
 *
 * Privacy:
 *   - Comparable rents NEVER carry the full address. We hash the
 *     upstream listing identifier (or address) into
 *     `addressFingerprint`.
 */

import { createHash } from 'node:crypto';
import type {
  ComparableRent,
  ComparableRentsArgs,
  MarketDataCacheServiceShape,
  MarketDataOutcome,
  MarketDataPort,
  VacancyTrend,
  VacancyTrendArgs,
} from '../port.js';

const PROVIDER = 'zillow';
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MOCK_HEADER = 'X-MOCK-MARKET-DATA';

// ─────────────────────────────────────────────────────────────────────
// Shape we expect from the (TODO) Zillow endpoint. Documented here so
// future-us can map the real response into our typed comparables /
// vacancy trends without scattering knowledge across the file.
// Schema lifted from Zillow's listing-by-jurisdiction shape (Bridge
// Interactive RESO standard) and trimmed to the fields we care about.
// ─────────────────────────────────────────────────────────────────────

interface ZillowComparableListing {
  readonly id: string | number;
  readonly address?: string;
  readonly listingId?: string;
  readonly bedrooms?: number;
  readonly livingAreaSqFt?: number | null;
  readonly listPrice?: number;
  readonly currency?: string;
  readonly observedAt?: string;
}

interface ZillowComparableResponse {
  readonly listings: ReadonlyArray<ZillowComparableListing>;
}

interface ZillowVacancyTrendResponse {
  readonly meanDaysVacant: number;
  readonly p50DaysVacant: number;
  readonly p90DaysVacant: number;
  readonly sampleSize: number;
  readonly observedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Public factory
// ─────────────────────────────────────────────────────────────────────

export interface ZillowMarketDataAdapterConfig {
  /** When absent, every call returns `{ kind: 'unconfigured' }`. */
  readonly apiKey?: string;
  /** Cache port — duck-typed; supplied by the composition root. */
  readonly cache?: MarketDataCacheServiceShape;
  /** Override the cache TTL. Default: 1 hour. */
  readonly cacheTtlMs?: number;
  /** Override the network call (tests use this to inject mock fetch). */
  readonly fetch?: typeof fetch;
}

export function createZillowMarketDataAdapter(
  config: ZillowMarketDataAdapterConfig = {},
): MarketDataPort {
  const fetchImpl: typeof fetch =
    config.fetch ?? (typeof fetch !== 'undefined' ? fetch : undefined as unknown as typeof fetch);
  const cacheTtlMs =
    Number.isFinite(config.cacheTtlMs) && (config.cacheTtlMs ?? 0) > 0
      ? Number(config.cacheTtlMs)
      : DEFAULT_CACHE_TTL_MS;

  return {
    provider: PROVIDER,

    async fetchComparableRents(args) {
      if (!config.apiKey) return unconfigured(PROVIDER);

      const queryJson = normaliseComparableArgs(args);
      const cacheKey = makeCacheKey(PROVIDER, 'comparable_rents', queryJson);
      const cached = await tryCacheGet<ReadonlyArray<ComparableRent>>(
        config.cache,
        cacheKey,
      );
      if (cached) return cached;

      try {
        const url = buildComparableUrl(args);
        const res = await fetchImpl(url, {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) {
          return errorOutcome(
            PROVIDER,
            `zillow comparable_rents HTTP ${res.status}`,
          );
        }
        const raw = (await res.json()) as ZillowComparableResponse;
        const data = mapComparableRents(raw, args);

        const fetchedAt = new Date().toISOString();
        await tryCachePut(
          config.cache,
          cacheKey,
          PROVIDER,
          queryJson,
          { data, fetchedAt },
          cacheTtlMs,
        );

        return { kind: 'ok', data, cached: false, fetchedAt };
      } catch (err) {
        return errorOutcome(
          PROVIDER,
          `zillow comparable_rents failed: ${describeErr(err)}`,
        );
      }
    },

    async fetchVacancyTrends(args) {
      if (!config.apiKey) return unconfigured(PROVIDER);

      const queryJson = normaliseVacancyArgs(args);
      const cacheKey = makeCacheKey(PROVIDER, 'vacancy_trends', queryJson);
      const cached = await tryCacheGet<VacancyTrend>(config.cache, cacheKey);
      if (cached) return cached;

      try {
        const url = buildVacancyUrl(args);
        const res = await fetchImpl(url, {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) {
          return errorOutcome(
            PROVIDER,
            `zillow vacancy_trends HTTP ${res.status}`,
          );
        }
        const raw = (await res.json()) as ZillowVacancyTrendResponse;
        const data = mapVacancyTrend(raw);

        const fetchedAt = new Date().toISOString();
        await tryCachePut(
          config.cache,
          cacheKey,
          PROVIDER,
          queryJson,
          { data, fetchedAt },
          cacheTtlMs,
        );

        return { kind: 'ok', data, cached: false, fetchedAt };
      } catch (err) {
        return errorOutcome(
          PROVIDER,
          `zillow vacancy_trends failed: ${describeErr(err)}`,
        );
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// URL builders — placeholders. The real Zillow integration lands
// behind these.
//
// TODO(zillow): map zillow/listing-by-jurisdiction endpoint
// TODO(zillow): map zillow/vacancy-trend endpoint
// ─────────────────────────────────────────────────────────────────────

function buildComparableUrl(args: ComparableRentsArgs): string {
  const params = new URLSearchParams({
    jurisdiction: args.jurisdiction,
    class: args.propertyClass,
    windowDays: String(args.windowDays),
  });
  if (typeof args.bedrooms === 'number') {
    params.set('bedrooms', String(args.bedrooms));
  }
  if (typeof args.squareFeet === 'number') {
    params.set('sqft', String(args.squareFeet));
  }
  return `https://api.bridgedataoutput.com/api/v2/zestimates_v2/comparables?${params.toString()}`;
}

function buildVacancyUrl(args: VacancyTrendArgs): string {
  const params = new URLSearchParams({
    jurisdiction: args.jurisdiction,
    class: args.propertyClass,
    windowDays: String(args.windowDays),
  });
  return `https://api.bridgedataoutput.com/api/v2/zestimates_v2/vacancy?${params.toString()}`;
}

// ─────────────────────────────────────────────────────────────────────
// Mapping
// ─────────────────────────────────────────────────────────────────────

function mapComparableRents(
  raw: ZillowComparableResponse,
  args: ComparableRentsArgs,
): ReadonlyArray<ComparableRent> {
  const listings = Array.isArray(raw?.listings) ? raw.listings : [];
  const out: ComparableRent[] = [];
  for (const l of listings) {
    if (typeof l?.listPrice !== 'number') continue;
    const sqft = typeof l.livingAreaSqFt === 'number' ? l.livingAreaSqFt : null;
    out.push({
      rentMajor: l.listPrice,
      currency: typeof l.currency === 'string' && l.currency ? l.currency : 'USD',
      bedrooms:
        typeof l.bedrooms === 'number' ? l.bedrooms : args.bedrooms ?? 0,
      squareFeet: sqft,
      addressFingerprint: fingerprint(
        String(l.listingId ?? l.address ?? l.id ?? ''),
      ),
      observedAt:
        typeof l.observedAt === 'string'
          ? l.observedAt
          : new Date().toISOString(),
    });
  }
  return out;
}

function mapVacancyTrend(raw: ZillowVacancyTrendResponse): VacancyTrend {
  return {
    meanDaysVacant: Number(raw?.meanDaysVacant ?? 0),
    p50DaysVacant: Number(raw?.p50DaysVacant ?? 0),
    p90DaysVacant: Number(raw?.p90DaysVacant ?? 0),
    sampleSize: Number(raw?.sampleSize ?? 0),
    observedAt:
      typeof raw?.observedAt === 'string'
        ? raw.observedAt
        : new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Helpers — shared shape with the airbnb adapter.
// ─────────────────────────────────────────────────────────────────────

function unconfigured(provider: string): MarketDataOutcome<never> {
  return {
    kind: 'unconfigured',
    provider,
    hint: `set the ${provider.toUpperCase()}_API_KEY environment variable to enable this adapter`,
  };
}

function errorOutcome(
  provider: string,
  message: string,
): MarketDataOutcome<never> {
  return { kind: 'error', provider, message };
}

function describeErr(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'unknown error';
}

function fingerprint(input: string): string {
  if (!input) return 'anonymous';
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function makeCacheKey(
  provider: string,
  op: string,
  query: Record<string, unknown>,
): string {
  const canonical = JSON.stringify(query, Object.keys(query).sort());
  return createHash('sha256')
    .update(`${provider}|${op}|${canonical}`)
    .digest('hex');
}

function normaliseComparableArgs(
  args: ComparableRentsArgs,
): Record<string, unknown> {
  return {
    jurisdiction: args.jurisdiction,
    propertyClass: args.propertyClass,
    bedrooms: args.bedrooms ?? null,
    squareFeet: args.squareFeet ?? null,
    windowDays: args.windowDays,
  };
}

function normaliseVacancyArgs(
  args: VacancyTrendArgs,
): Record<string, unknown> {
  return {
    jurisdiction: args.jurisdiction,
    propertyClass: args.propertyClass,
    windowDays: args.windowDays,
  };
}

async function tryCacheGet<T>(
  cache: MarketDataCacheServiceShape | undefined,
  cacheKey: string,
): Promise<MarketDataOutcome<T> | null> {
  if (!cache) return null;
  try {
    const hit = await cache.get(cacheKey);
    if (!hit) return null;
    const payload = hit.resultJson as { data: T; fetchedAt: string } | null;
    if (!payload || payload.data === undefined) return null;
    return {
      kind: 'ok',
      data: payload.data,
      cached: true,
      fetchedAt: payload.fetchedAt ?? hit.fetchedAt,
    };
  } catch {
    return null;
  }
}

async function tryCachePut(
  cache: MarketDataCacheServiceShape | undefined,
  cacheKey: string,
  provider: string,
  queryJson: unknown,
  payload: { data: unknown; fetchedAt: string },
  ttlMs: number,
): Promise<void> {
  if (!cache) return;
  try {
    await cache.put(cacheKey, provider, queryJson, payload, ttlMs);
  } catch {
    // Cache failures are silent — the call already succeeded; we'd
    // rather serve stale data later than fail the user-facing call.
  }
}

// Re-export the mock header for tests that wire it through a custom
// fetch impl. Keeps the symbol stable across versions.
export { MOCK_HEADER as ZILLOW_MOCK_HEADER };
