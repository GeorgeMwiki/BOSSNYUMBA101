/**
 * Airbnb MarketDataPort adapter.
 *
 * Sibling of `zillow.ts` — same contract, same caching/error/
 * unconfigured discipline, different upstream shape. The Airbnb data
 * model is short-let-oriented; we coerce nightly rates into a monthly-
 * equivalent rentMajor (× 30) so downstream callers can compare with
 * long-let comparables on the same axis.
 *
 * Production wiring is gated behind `config.apiKey`. When absent every
 * call resolves to `{ kind: 'unconfigured' }`.
 *
 * The actual upstream HTTP call is left as a TODO. Tests inject a
 * custom `fetch` impl; production callers without a real Airbnb
 * partner integration get `{ kind: 'unconfigured' }`.
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

const PROVIDER = 'airbnb';
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
// AM-4: removed `MOCK_HEADER = 'X-MOCK-MARKET-DATA'` — dead symbol; see
// zillow.ts for full rationale.

// ─────────────────────────────────────────────────────────────────────
// Shape we expect from the (TODO) Airbnb partner endpoint. This mirrors
// the Airbnb Public API "market insights" beta surface; trimmed to the
// fields we map.
// ─────────────────────────────────────────────────────────────────────

interface AirbnbListing {
  readonly id: string | number;
  readonly listingId?: string;
  readonly nightlyRate: number;
  readonly currency: string;
  readonly bedrooms?: number;
  readonly sqft?: number | null;
  readonly observedAt?: string;
}

interface AirbnbComparableResponse {
  readonly results: ReadonlyArray<AirbnbListing>;
}

interface AirbnbOccupancyResponse {
  readonly meanDaysVacant: number;
  readonly p50DaysVacant: number;
  readonly p90DaysVacant: number;
  readonly sampleSize: number;
  readonly observedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Public factory
// ─────────────────────────────────────────────────────────────────────

export interface AirbnbMarketDataAdapterConfig {
  readonly apiKey?: string;
  readonly cache?: MarketDataCacheServiceShape;
  readonly cacheTtlMs?: number;
  readonly fetch?: typeof fetch;
}

export function createAirbnbMarketDataAdapter(
  config: AirbnbMarketDataAdapterConfig = {},
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
            `airbnb comparable_rents HTTP ${res.status}`,
          );
        }
        const raw = (await res.json()) as AirbnbComparableResponse;
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
          `airbnb comparable_rents failed: ${describeErr(err)}`,
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
            `airbnb vacancy_trends HTTP ${res.status}`,
          );
        }
        const raw = (await res.json()) as AirbnbOccupancyResponse;
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
          `airbnb vacancy_trends failed: ${describeErr(err)}`,
        );
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// URL builders — placeholders.
//
// TODO(airbnb): map airbnb/market-insights/listings endpoint
// TODO(airbnb): map airbnb/market-insights/occupancy endpoint
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
  return `https://api.airbnb.com/v2/market-insights/listings?${params.toString()}`;
}

function buildVacancyUrl(args: VacancyTrendArgs): string {
  const params = new URLSearchParams({
    jurisdiction: args.jurisdiction,
    class: args.propertyClass,
    windowDays: String(args.windowDays),
  });
  return `https://api.airbnb.com/v2/market-insights/occupancy?${params.toString()}`;
}

// ─────────────────────────────────────────────────────────────────────
// Mapping
// ─────────────────────────────────────────────────────────────────────

function mapComparableRents(
  raw: AirbnbComparableResponse,
  args: ComparableRentsArgs,
): ReadonlyArray<ComparableRent> {
  const listings = Array.isArray(raw?.results) ? raw.results : [];
  const out: ComparableRent[] = [];
  for (const l of listings) {
    if (typeof l?.nightlyRate !== 'number' || !Number.isFinite(l.nightlyRate)) {
      continue;
    }
    const sqft = typeof l.sqft === 'number' ? l.sqft : null;
    out.push({
      // Coerce nightly to monthly-equivalent so callers can compare on
      // the same axis as long-let comparables.
      rentMajor: Math.round(l.nightlyRate * 30 * 100) / 100,
      currency: typeof l.currency === 'string' && l.currency ? l.currency : 'USD',
      bedrooms:
        typeof l.bedrooms === 'number' ? l.bedrooms : args.bedrooms ?? 0,
      squareFeet: sqft,
      addressFingerprint: fingerprint(
        String(l.listingId ?? l.id ?? ''),
      ),
      observedAt:
        typeof l.observedAt === 'string'
          ? l.observedAt
          : new Date().toISOString(),
    });
  }
  return out;
}

function mapVacancyTrend(raw: AirbnbOccupancyResponse): VacancyTrend {
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
// Helpers
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
    // Cache failures are silent — the call already succeeded.
  }
}

// AM-4: removed `export { MOCK_HEADER as AIRBNB_MOCK_HEADER }` — dead
// symbol with no callers in test or production code.
