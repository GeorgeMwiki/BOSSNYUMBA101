/**
 * Zillow MarketDataPort adapter — unit tests.
 *
 * Coverage:
 *   - No API key → unconfigured outcome (never throws)
 *   - API key + cache miss + mock fetch → ok outcome, fetch called
 *   - Cache hit → ok with cached=true, fetch NOT called
 *   - Fetch throws → error outcome (never throws)
 *   - Non-OK HTTP status → error outcome
 *   - vacancy_trends path mirrors comparable_rents discipline
 *   - Address fingerprint never includes the raw upstream id
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createZillowMarketDataAdapter,
  type MarketDataCacheServiceShape,
} from '../index.js';

// ─────────────────────────────────────────────────────────────────────
// Fakes
// ─────────────────────────────────────────────────────────────────────

function makeMockFetch(responseBody: unknown, opts: { ok?: boolean; status?: number } = {}): typeof fetch {
  const ok = opts.ok ?? true;
  const status = opts.status ?? (ok ? 200 : 500);
  return vi.fn(async () => ({
    ok,
    status,
    async json() {
      return responseBody;
    },
  }) as unknown as Response) as unknown as typeof fetch;
}

function makeCache(): MarketDataCacheServiceShape & {
  store: Map<string, { resultJson: unknown; fetchedAt: string }>;
  getCalls: number;
  putCalls: number;
} {
  const store = new Map<string, { resultJson: unknown; fetchedAt: string }>();
  let getCalls = 0;
  let putCalls = 0;
  const cache = {
    store,
    get getCalls() {
      return getCalls;
    },
    get putCalls() {
      return putCalls;
    },
    async get(key: string) {
      getCalls += 1;
      return store.get(key) ?? null;
    },
    async put(
      key: string,
      _provider: string,
      _queryJson: unknown,
      resultJson: unknown,
      _ttlMs: number,
    ) {
      putCalls += 1;
      store.set(key, {
        resultJson,
        fetchedAt: new Date().toISOString(),
      });
    },
  };
  return cache;
}

// ─────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────

describe('createZillowMarketDataAdapter', () => {
  it('returns unconfigured when no API key is supplied (comparable_rents)', async () => {
    const adapter = createZillowMarketDataAdapter({});

    const out = await adapter.fetchComparableRents({
      jurisdiction: 'TZ-DAR',
      propertyClass: 'residential-2br',
      windowDays: 90,
    });

    expect(out.kind).toBe('unconfigured');
    if (out.kind === 'unconfigured') {
      expect(out.provider).toBe('zillow');
      expect(out.hint).toMatch(/ZILLOW_API_KEY/);
    }
  });

  it('returns unconfigured when no API key is supplied (vacancy_trends)', async () => {
    const adapter = createZillowMarketDataAdapter({});

    const out = await adapter.fetchVacancyTrends({
      jurisdiction: 'KE-NAIROBI',
      propertyClass: 'residential-1br',
      windowDays: 60,
    });

    expect(out.kind).toBe('unconfigured');
  });

  it('fetches comparable_rents on cache miss and returns ok with mapped data', async () => {
    const fakeResponse = {
      listings: [
        {
          id: 'l-1',
          listingId: 'zillow-listing-1',
          listPrice: 1500,
          currency: 'USD',
          bedrooms: 2,
          livingAreaSqFt: 900,
          observedAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'l-2',
          listingId: 'zillow-listing-2',
          listPrice: 1800,
          currency: 'USD',
          bedrooms: 2,
          livingAreaSqFt: null,
          observedAt: '2026-01-02T00:00:00Z',
        },
      ],
    };
    const fetchSpy = vi.fn(makeMockFetch(fakeResponse));
    const cache = makeCache();
    const adapter = createZillowMarketDataAdapter({
      apiKey: 'test-key',
      cache,
      fetch: fetchSpy,
    });

    const out = await adapter.fetchComparableRents({
      jurisdiction: 'US-NY-BROOKLYN',
      propertyClass: 'residential-2br',
      bedrooms: 2,
      windowDays: 90,
    });

    expect(out.kind).toBe('ok');
    if (out.kind === 'ok') {
      expect(out.cached).toBe(false);
      expect(out.data).toHaveLength(2);
      expect(out.data[0]?.rentMajor).toBe(1500);
      expect(out.data[0]?.bedrooms).toBe(2);
      expect(out.data[0]?.squareFeet).toBe(900);
      expect(out.data[1]?.squareFeet).toBeNull();
      // Address fingerprint never carries the raw listing id verbatim.
      expect(out.data[0]?.addressFingerprint).not.toBe('zillow-listing-1');
      expect(out.data[0]?.addressFingerprint).toMatch(/^[0-9a-f]{16}$/);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(cache.putCalls).toBe(1);
  });

  it('returns cached=true on cache hit and never calls fetch', async () => {
    const fakeResponse = {
      listings: [
        {
          id: 'l-1',
          listingId: 'zillow-listing-1',
          listPrice: 1500,
          currency: 'USD',
          bedrooms: 2,
          livingAreaSqFt: 900,
          observedAt: '2026-01-01T00:00:00Z',
        },
      ],
    };
    const fetchSpy = vi.fn(makeMockFetch(fakeResponse));
    const cache = makeCache();
    const adapter = createZillowMarketDataAdapter({
      apiKey: 'test-key',
      cache,
      fetch: fetchSpy,
    });

    // First call populates cache.
    await adapter.fetchComparableRents({
      jurisdiction: 'US-NY-BROOKLYN',
      propertyClass: 'residential-2br',
      bedrooms: 2,
      windowDays: 90,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call (same args) should hit cache.
    const second = await adapter.fetchComparableRents({
      jurisdiction: 'US-NY-BROOKLYN',
      propertyClass: 'residential-2br',
      bedrooms: 2,
      windowDays: 90,
    });

    expect(second.kind).toBe('ok');
    if (second.kind === 'ok') {
      expect(second.cached).toBe(true);
      expect(second.data).toHaveLength(1);
    }
    // Fetch was NOT called a second time.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns error outcome (does NOT throw) when fetch rejects', async () => {
    const failingFetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const adapter = createZillowMarketDataAdapter({
      apiKey: 'test-key',
      fetch: failingFetch,
    });

    const out = await adapter.fetchComparableRents({
      jurisdiction: 'TZ-DAR',
      propertyClass: 'residential-2br',
      windowDays: 90,
    });

    expect(out.kind).toBe('error');
    if (out.kind === 'error') {
      expect(out.provider).toBe('zillow');
      expect(out.message).toMatch(/network down/);
    }
  });

  it('returns error outcome on non-OK HTTP status', async () => {
    const adapter = createZillowMarketDataAdapter({
      apiKey: 'test-key',
      fetch: makeMockFetch({}, { ok: false, status: 503 }),
    });

    const out = await adapter.fetchComparableRents({
      jurisdiction: 'TZ-DAR',
      propertyClass: 'residential-2br',
      windowDays: 90,
    });

    expect(out.kind).toBe('error');
    if (out.kind === 'error') {
      expect(out.message).toMatch(/HTTP 503/);
    }
  });

  it('fetchVacancyTrends maps the response and caches it', async () => {
    const fakeResponse = {
      meanDaysVacant: 21.5,
      p50DaysVacant: 18,
      p90DaysVacant: 60,
      sampleSize: 240,
      observedAt: '2026-02-15T00:00:00Z',
    };
    const fetchSpy = vi.fn(makeMockFetch(fakeResponse));
    const cache = makeCache();
    const adapter = createZillowMarketDataAdapter({
      apiKey: 'test-key',
      cache,
      fetch: fetchSpy,
    });

    const out = await adapter.fetchVacancyTrends({
      jurisdiction: 'TZ-DAR',
      propertyClass: 'residential-2br',
      windowDays: 90,
    });

    expect(out.kind).toBe('ok');
    if (out.kind === 'ok') {
      expect(out.cached).toBe(false);
      expect(out.data.meanDaysVacant).toBe(21.5);
      expect(out.data.p90DaysVacant).toBe(60);
      expect(out.data.sampleSize).toBe(240);
    }
    expect(cache.putCalls).toBe(1);

    // Second call hits cache.
    const second = await adapter.fetchVacancyTrends({
      jurisdiction: 'TZ-DAR',
      propertyClass: 'residential-2br',
      windowDays: 90,
    });
    expect(second.kind).toBe('ok');
    if (second.kind === 'ok') {
      expect(second.cached).toBe(true);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('exposes a stable provider id', () => {
    const adapter = createZillowMarketDataAdapter({});
    expect(adapter.provider).toBe('zillow');
  });

  it('different query args produce different cache keys (no false hits)', async () => {
    const fakeResponse = { listings: [] };
    const fetchSpy = vi.fn(makeMockFetch(fakeResponse));
    const cache = makeCache();
    const adapter = createZillowMarketDataAdapter({
      apiKey: 'test-key',
      cache,
      fetch: fetchSpy,
    });

    await adapter.fetchComparableRents({
      jurisdiction: 'TZ-DAR',
      propertyClass: 'residential-2br',
      bedrooms: 2,
      windowDays: 90,
    });
    await adapter.fetchComparableRents({
      jurisdiction: 'TZ-DAR',
      propertyClass: 'residential-2br',
      bedrooms: 3, // different
      windowDays: 90,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(cache.store.size).toBe(2);
  });
});
