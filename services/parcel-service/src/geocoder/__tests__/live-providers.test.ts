/**
 * Real-provider geocoder tests.
 *
 * GATING: this file's network-bound tests only run when
 * `LIVE_GEOCODER_TESTS=true`. The offline-safe tests (fetch stubs,
 * shape checks, rate-limit logic) ALWAYS run so the wiring is
 * exercised on every CI invocation without touching the network.
 *
 * To opt in to live calls:
 *   LIVE_GEOCODER_TESTS=true \
 *   GOOGLE_KG_API_KEY=AIza... \
 *   pnpm --filter @bossnyumba/parcel-service test
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  createNominatimGeocoder,
  createNominatimStub,
  __resetNominatimRateLimitForTests,
  type NominatimFetch,
} from '../nominatim.js';
import {
  createGoogleGeocoder,
  createGoogleGeocoderStub,
  type GoogleFetch,
} from '../google.js';

const liveEnabled = String(process.env.LIVE_GEOCODER_TESTS ?? '').toLowerCase() === 'true';

// ---------------------------------------------------------------------------
// Offline tests (always run) — exercise the real adapter shape with a
// stub fetcher. Catches request-construction bugs without hitting the
// network.
// ---------------------------------------------------------------------------

describe('createNominatimGeocoder — offline (stubbed fetch)', () => {
  afterEach(() => {
    __resetNominatimRateLimitForTests();
  });

  it('sends the correct GET, User-Agent, and parses the first row', async () => {
    const calls: Array<{ url: string; headers?: Readonly<Record<string, string>> }> = [];
    const fakeFetch: NominatimFetch = async (url, init) => {
      calls.push({ url, ...(init?.headers !== undefined ? { headers: init.headers } : {}) });
      return {
        ok: true,
        status: 200,
        async json() {
          return [
            {
              lat: '-1.286389',
              lon: '36.817223',
              display_name: 'Nairobi, Kenya',
              importance: 0.72,
            },
          ];
        },
      };
    };
    const geo = createNominatimGeocoder({
      fetch: fakeFetch,
      skipRateLimit: true,
    });
    const out = await geo.geocode({ address: 'Nairobi' });
    expect(out).not.toBeNull();
    expect(out!.provider).toBe('nominatim');
    expect(out!.point.coordinates[1]).toBeCloseTo(-1.28639, 4);
    expect(out!.point.coordinates[0]).toBeCloseTo(36.81722, 4);
    expect(out!.formattedAddress).toBe('Nairobi, Kenya');
    expect(out!.confidence).toBeCloseTo(0.72, 3);

    // Verify URL + headers per OSM Usage Policy.
    expect(calls.length).toBe(1);
    const { url, headers } = calls[0]!;
    expect(url).toContain('https://nominatim.openstreetmap.org/search');
    expect(url).toContain('format=json');
    expect(url).toContain('q=Nairobi');
    expect(url).toContain('limit=1');
    expect(url).toContain('accept-language=en');
    expect(headers?.['User-Agent']).toBe('BossNyumba/1.0 (georgemwikila@gmail.com)');
  });

  it('returns null for empty results array', async () => {
    const fakeFetch: NominatimFetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        return [];
      },
    });
    const geo = createNominatimGeocoder({ fetch: fakeFetch, skipRateLimit: true });
    expect(await geo.geocode({ address: 'definitely not a real place 9X8' })).toBeNull();
  });

  it('throws on non-2xx so the chain catches and falls through', async () => {
    const fakeFetch: NominatimFetch = async () => ({
      ok: false,
      status: 503,
      async json() {
        return {};
      },
    });
    const geo = createNominatimGeocoder({ fetch: fakeFetch, skipRateLimit: true });
    await expect(geo.geocode({ address: 'x' })).rejects.toThrow(/HTTP 503/);
  });

  it('honours a custom User-Agent override', async () => {
    let captured = '';
    const fakeFetch: NominatimFetch = async (_url, init) => {
      captured = (init?.headers?.['User-Agent'] as string) ?? '';
      return { ok: true, status: 200, async json() { return []; } };
    };
    const geo = createNominatimGeocoder({
      fetch: fakeFetch,
      userAgent: 'CustomAgent/2.0 (ops@example.com)',
      skipRateLimit: true,
    });
    await geo.geocode({ address: 'x' });
    expect(captured).toBe('CustomAgent/2.0 (ops@example.com)');
  });
});

describe('createGoogleGeocoder — offline (stubbed fetch)', () => {
  it('sends the correct request and parses OK results', async () => {
    const calls: Array<{ url: string }> = [];
    const fakeFetch: GoogleFetch = async (url) => {
      calls.push({ url });
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            status: 'OK',
            results: [
              {
                formatted_address: '4 Pall Mall, London',
                geometry: {
                  location: { lat: 51.5074, lng: -0.1278 },
                  location_type: 'ROOFTOP',
                },
              },
            ],
          };
        },
      };
    };
    const geo = createGoogleGeocoder({ apiKey: 'KEY', fetch: fakeFetch });
    const out = await geo.geocode({ address: '4 Pall Mall, London' });
    expect(out).not.toBeNull();
    expect(out!.provider).toBe('google');
    expect(out!.point.coordinates).toEqual([-0.1278, 51.5074]);
    expect(out!.confidence).toBe(0.95);

    const { url } = calls[0]!;
    expect(url).toContain('https://maps.googleapis.com/maps/api/geocode/json');
    expect(url).toContain('key=KEY');
    expect(url).toContain('address=4+Pall+Mall%2C+London');
  });

  it('returns null on ZERO_RESULTS', async () => {
    const fakeFetch: GoogleFetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        return { status: 'ZERO_RESULTS', results: [] };
      },
    });
    const geo = createGoogleGeocoder({ apiKey: 'KEY', fetch: fakeFetch });
    expect(await geo.geocode({ address: 'nothing' })).toBeNull();
  });

  it('throws on OVER_QUERY_LIMIT so the chain falls through', async () => {
    const fakeFetch: GoogleFetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        return { status: 'OVER_QUERY_LIMIT', error_message: 'Daily quota exceeded' };
      },
    });
    const geo = createGoogleGeocoder({ apiKey: 'KEY', fetch: fakeFetch });
    await expect(geo.geocode({ address: 'x' })).rejects.toThrow(/OVER_QUERY_LIMIT/);
  });

  it('throws when no API key is configured', () => {
    const before = process.env.GOOGLE_KG_API_KEY;
    const before2 = process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_KG_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    try {
      expect(() => createGoogleGeocoder()).toThrow(/missing API key/);
    } finally {
      if (before !== undefined) process.env.GOOGLE_KG_API_KEY = before;
      if (before2 !== undefined) process.env.GOOGLE_MAPS_API_KEY = before2;
    }
  });
});

describe('stubs still exported (back-compat)', () => {
  it('createGoogleGeocoderStub returns a deterministic shape', async () => {
    const stub = createGoogleGeocoderStub();
    const a = await stub.geocode({ address: 'X' });
    const b = await stub.geocode({ address: 'X' });
    expect(a).toEqual(b);
  });

  it('createNominatimStub returns a deterministic shape', async () => {
    const stub = createNominatimStub();
    const a = await stub.geocode({ address: 'Y' });
    const b = await stub.geocode({ address: 'Y' });
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// LIVE tests — only when LIVE_GEOCODER_TESTS=true.
// These actually hit the network and respect rate limits (slow!).
// ---------------------------------------------------------------------------

describe.runIf(liveEnabled)('LIVE — Nominatim against public OSM', () => {
  it('resolves "Nairobi, Kenya" to a point inside the Nairobi bbox', async () => {
    const geo = createNominatimGeocoder(); // uses global fetch, real rate limit
    const out = await geo.geocode({ address: 'Nairobi, Kenya' });
    expect(out).not.toBeNull();
    expect(out!.provider).toBe('nominatim');
    const [lng, lat] = out!.point.coordinates;
    // Nairobi rough bbox.
    expect(lat).toBeGreaterThan(-1.5);
    expect(lat).toBeLessThan(-1.0);
    expect(lng).toBeGreaterThan(36.5);
    expect(lng).toBeLessThan(37.2);
  }, 30_000);
});

describe.runIf(liveEnabled && Boolean(process.env.GOOGLE_KG_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY))(
  'LIVE — Google against real API',
  () => {
    it('resolves "1600 Amphitheatre Parkway, Mountain View, CA" near Googleplex', async () => {
      const geo = createGoogleGeocoder();
      const out = await geo.geocode({
        address: '1600 Amphitheatre Parkway, Mountain View, CA',
      });
      expect(out).not.toBeNull();
      expect(out!.provider).toBe('google');
      const [lng, lat] = out!.point.coordinates;
      expect(lat).toBeGreaterThan(37.4);
      expect(lat).toBeLessThan(37.5);
      expect(lng).toBeLessThan(-122.0);
      expect(lng).toBeGreaterThan(-122.1);
    }, 30_000);
  },
);
