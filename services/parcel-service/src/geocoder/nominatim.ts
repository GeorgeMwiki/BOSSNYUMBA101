/**
 * OpenStreetMap Nominatim adapter.
 *
 * Spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md` §8.
 *
 * Two factories:
 *
 *   1. `createNominatimStub()` — deterministic in-memory stub. Used by
 *      the default chain when no live providers are enabled so unit
 *      tests stay offline and reproducible.
 *
 *   2. `createNominatimGeocoder()` — REAL HTTP adapter against the
 *      public OSM endpoint. Honours OSM's Usage Policy:
 *        - Custom User-Agent (REQUIRED: identifies the operator).
 *        - ≤ 1 request / second from any single process
 *          (module-scoped timestamp guard).
 *      Reference: https://operations.osmfoundation.org/policies/nominatim/
 *
 * Env vars consumed (real adapter only):
 *   - none required. Operator email is baked into the User-Agent.
 *   - `NOMINATIM_BASE_URL` (optional) — override endpoint, e.g. to a
 *     self-hosted instance for production scale.
 *   - `NOMINATIM_USER_AGENT` (optional) — override the User-Agent string.
 */
import type { GeocodeQuery, GeocodeResult } from '@bossnyumba/spatial-engine';

export interface NominatimGeocoder {
  readonly provider: 'nominatim';
  geocode(query: GeocodeQuery): Promise<GeocodeResult | null>;
}

/**
 * Stub: returns a deterministic point inside the Nairobi bbox with low
 * confidence so callers know to flag the result for manual review.
 */
export function createNominatimStub(): NominatimGeocoder {
  return Object.freeze({
    provider: 'nominatim' as const,
    async geocode(query: GeocodeQuery): Promise<GeocodeResult | null> {
      if (!query.address || query.address.trim().length === 0) {
        return null;
      }
      const seed = hashString(query.address);
      const lon = 36.75 + ((seed % 800) / 1000) * 0.15;
      const lat = -1.32 + (((seed >>> 10) % 800) / 1000) * 0.15;
      return {
        provider: 'nominatim',
        formattedAddress: query.address.trim(),
        point: { type: 'Point', coordinates: [round5(lon), round5(lat)] },
        confidence: 0.5,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Real HTTP adapter (Phase F).
// ---------------------------------------------------------------------------

/**
 * Public OSM endpoint. Operators running this at scale MUST switch to a
 * self-hosted Nominatim or a paid host (Stadia, Pelias, etc.) per the
 * OSM Usage Policy.
 */
const DEFAULT_BASE_URL = 'https://nominatim.openstreetmap.org';

/**
 * Required User-Agent. The OSM Usage Policy demands a string that
 * identifies the operator (project name + contact). Spoofing or omitting
 * this is grounds for an IP ban.
 */
const DEFAULT_USER_AGENT = 'BossNyumba/1.0 (georgemwikila@gmail.com)';

/** Hard cap from OSM policy: ≤ 1 request per second per IP. */
const MIN_REQUEST_INTERVAL_MS = 1000;

/**
 * Module-scoped timestamp of the last request. A `Date.now()` guard is
 * enough for our use (single-process Node services); production at
 * scale should move to a distributed token bucket.
 */
let lastRequestAt = 0;

/** Minimal `fetch` surface — lets tests inject a stub without DOM types. */
export type NominatimFetch = (
  input: string,
  init?: { readonly method?: string; readonly headers?: Readonly<Record<string, string>> },
) => Promise<{ readonly ok: boolean; readonly status: number; json(): Promise<unknown> }>;

export interface NominatimGeocoderOpts {
  readonly baseUrl?: string;
  readonly userAgent?: string;
  readonly fetch?: NominatimFetch;
  /** Test seam: override the rate-limit guard. */
  readonly skipRateLimit?: boolean;
}

interface NominatimResultRow {
  readonly lat: string;
  readonly lon: string;
  readonly display_name?: string;
  readonly importance?: number;
}

/**
 * Real Nominatim adapter. Returns `null` when the endpoint reports zero
 * results so the chain falls through to the next provider.
 */
export function createNominatimGeocoder(opts: NominatimGeocoderOpts = {}): NominatimGeocoder {
  const baseUrl = stripTrailingSlash(opts.baseUrl ?? readEnv('NOMINATIM_BASE_URL') ?? DEFAULT_BASE_URL);
  const userAgent = opts.userAgent ?? readEnv('NOMINATIM_USER_AGENT') ?? DEFAULT_USER_AGENT;
  const fetcher: NominatimFetch | undefined =
    opts.fetch ?? (globalThis as { fetch?: NominatimFetch }).fetch;
  if (!fetcher) {
    throw new Error(
      'createNominatimGeocoder: no `fetch` available. Provide opts.fetch or run on Node>=18.',
    );
  }
  const skipRateLimit = opts.skipRateLimit === true;

  return Object.freeze({
    provider: 'nominatim' as const,
    async geocode(query: GeocodeQuery): Promise<GeocodeResult | null> {
      const address = (query.address ?? '').trim();
      if (!address) return null;

      if (!skipRateLimit) {
        await enforceOsmRateLimit();
      }

      const params = new URLSearchParams({
        format: 'json',
        q: address,
        limit: '1',
        'accept-language': 'en',
      });
      const url = `${baseUrl}/search?${params.toString()}`;

      const res = await fetcher(url, {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          // OSM is happier when we explicitly identify the JSON request.
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`nominatim: HTTP ${res.status} for "${address}"`);
      }
      const body = (await res.json()) as ReadonlyArray<NominatimResultRow> | unknown;
      if (!Array.isArray(body) || body.length === 0) return null;
      const row = body[0] as NominatimResultRow;
      const lat = Number(row.lat);
      const lon = Number(row.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const confidence = typeof row.importance === 'number'
        ? Math.max(0, Math.min(1, row.importance))
        : 0.6;
      return {
        provider: 'nominatim',
        formattedAddress: row.display_name ?? address,
        point: { type: 'Point', coordinates: [round5(lon), round5(lat)] },
        confidence,
      };
    },
  });
}

/**
 * Block until at least `MIN_REQUEST_INTERVAL_MS` has elapsed since the
 * last request. Sequential within a single process; cross-process
 * coordination requires a shared token bucket (out of scope here).
 */
async function enforceOsmRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    const wait = MIN_REQUEST_INTERVAL_MS - elapsed;
    await sleep(wait);
  }
  lastRequestAt = Date.now();
}

/** Test-only: reset the rate-limit timestamp so unit tests run fast. */
export function __resetNominatimRateLimitForTests(): void {
  lastRequestAt = 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  return env?.[name];
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}
