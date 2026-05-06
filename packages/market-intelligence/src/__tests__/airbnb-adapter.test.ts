/**
 * Airbnb MarketDataPort adapter — unit tests.
 *
 * Mirrors the zillow-adapter test suite. Covers:
 *   - No API key → unconfigured outcome
 *   - API key + cache miss + mock fetch → ok with mapped data
 *   - Nightly rate is coerced into a monthly-equivalent rentMajor
 *   - Cache hit → cached=true, no fetch call
 *   - Fetch throws → error outcome (no throw)
 *   - Non-OK HTTP status → error outcome
 *   - vacancy_trends path
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createAirbnbMarketDataAdapter,
  type MarketDataCacheServiceShape,
} from '../index.js';

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
  putCalls: number;
} {
  const store = new Map<string, { resultJson: unknown; fetchedAt: string }>();
  let putCalls = 0;
  return {
    store,
    get putCalls() {
      return putCalls;
    },
    async get(key: string) {
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
}

describe('createAirbnbMarketDataAdapter', () => {
  it('returns unconfigured when no API key is supplied', async () => {
    const adapter = createAirbnbMarketDataAdapter({});

    const out = await adapter.fetchComparableRents({
      jurisdiction: 'TZ-DAR',
      propertyClass: 'residential-1br',
      windowDays: 60,
    });

    expect(out.kind).toBe('unconfigured');
    if (out.kind === 'unconfigured') {
      expect(out.provider).toBe('airbnb');
      expect(out.hint).toMatch(/AIRBNB_API_KEY/);
    }
  });

  it('coerces nightly rate into monthly-equivalent rentMajor', async () => {
    const fakeResponse = {
      results: [
        {
          id: 'l-1',
          listingId: 'airbnb-listing-1',
          nightlyRate: 100,
          currency: 'USD',
          bedrooms: 1,
          sqft: 500,
          observedAt: '2026-03-01T00:00:00Z',
        },
      ],
    };
    const adapter = createAirbnbMarketDataAdapter({
      apiKey: 'test-key',
      fetch: makeMockFetch(fakeResponse),
    });

    const out = await adapter.fetchComparableRents({
      jurisdiction: 'KE-NAIROBI',
      propertyClass: 'residential-1br',
      windowDays: 60,
    });

    expect(out.kind).toBe('ok');
    if (out.kind === 'ok') {
      // 100/night × 30 = 3000/month
      expect(out.data[0]?.rentMajor).toBe(3000);
      expect(out.data[0]?.bedrooms).toBe(1);
      expect(out.data[0]?.squareFeet).toBe(500);
      expect(out.data[0]?.addressFingerprint).toMatch(/^[0-9a-f]{16}$/);
      expect(out.data[0]?.addressFingerprint).not.toBe('airbnb-listing-1');
    }
  });

  it('returns cached=true on second identical call', async () => {
    const fetchSpy = vi.fn(
      makeMockFetch({
        results: [
          {
            id: 'l-1',
            listingId: 'airbnb-listing-1',
            nightlyRate: 75,
            currency: 'USD',
            bedrooms: 1,
            sqft: null,
            observedAt: '2026-03-01T00:00:00Z',
          },
        ],
      }),
    );
    const cache = makeCache();
    const adapter = createAirbnbMarketDataAdapter({
      apiKey: 'test-key',
      cache,
      fetch: fetchSpy,
    });

    await adapter.fetchComparableRents({
      jurisdiction: 'KE-NAIROBI',
      propertyClass: 'residential-1br',
      windowDays: 60,
    });
    const second = await adapter.fetchComparableRents({
      jurisdiction: 'KE-NAIROBI',
      propertyClass: 'residential-1br',
      windowDays: 60,
    });

    expect(second.kind).toBe('ok');
    if (second.kind === 'ok') {
      expect(second.cached).toBe(true);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(cache.putCalls).toBe(1);
  });

  it('returns error outcome (does NOT throw) when fetch rejects', async () => {
    const failingFetch = vi.fn(async () => {
      throw new Error('connection reset');
    }) as unknown as typeof fetch;
    const adapter = createAirbnbMarketDataAdapter({
      apiKey: 'test-key',
      fetch: failingFetch,
    });

    const out = await adapter.fetchVacancyTrends({
      jurisdiction: 'KE-NAIROBI',
      propertyClass: 'residential-1br',
      windowDays: 60,
    });

    expect(out.kind).toBe('error');
    if (out.kind === 'error') {
      expect(out.provider).toBe('airbnb');
      expect(out.message).toMatch(/connection reset/);
    }
  });

  it('returns error outcome on non-OK HTTP status', async () => {
    const adapter = createAirbnbMarketDataAdapter({
      apiKey: 'test-key',
      fetch: makeMockFetch({}, { ok: false, status: 429 }),
    });

    const out = await adapter.fetchComparableRents({
      jurisdiction: 'KE-NAIROBI',
      propertyClass: 'residential-1br',
      windowDays: 60,
    });

    expect(out.kind).toBe('error');
    if (out.kind === 'error') {
      expect(out.message).toMatch(/HTTP 429/);
    }
  });

  it('fetchVacancyTrends maps the response and reports sample size', async () => {
    const adapter = createAirbnbMarketDataAdapter({
      apiKey: 'test-key',
      fetch: makeMockFetch({
        meanDaysVacant: 14.2,
        p50DaysVacant: 10,
        p90DaysVacant: 45,
        sampleSize: 380,
        observedAt: '2026-04-01T00:00:00Z',
      }),
    });

    const out = await adapter.fetchVacancyTrends({
      jurisdiction: 'TZ-DAR',
      propertyClass: 'residential-1br',
      windowDays: 90,
    });

    expect(out.kind).toBe('ok');
    if (out.kind === 'ok') {
      expect(out.data.meanDaysVacant).toBe(14.2);
      expect(out.data.p50DaysVacant).toBe(10);
      expect(out.data.p90DaysVacant).toBe(45);
      expect(out.data.sampleSize).toBe(380);
    }
  });

  it('exposes a stable provider id', () => {
    const adapter = createAirbnbMarketDataAdapter({});
    expect(adapter.provider).toBe('airbnb');
  });
});
