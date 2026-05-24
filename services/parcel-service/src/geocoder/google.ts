/**
 * Google Maps Geocoding adapter.
 *
 * Spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md` §8.
 *
 * Two factories:
 *
 *   1. `createGoogleGeocoderStub()` — deterministic in-memory stub used
 *      by the default chain when no API key is present so unit tests
 *      stay offline + reproducible.
 *
 *   2. `createGoogleGeocoder()` — REAL HTTP adapter against
 *      `https://maps.googleapis.com/maps/api/geocode/json`.
 *
 * Env vars consumed (real adapter):
 *   - `GOOGLE_KG_API_KEY` — primary key name (per the task spec).
 *   - `GOOGLE_MAPS_API_KEY` — accepted as a fallback so existing
 *     deployments that already provision the canonical Maps key name
 *     keep working without churn.
 */
import type { GeocodeQuery, GeocodeResult } from '../_spatial-engine-shim.js';

export interface GoogleGeocoder {
  readonly provider: 'google';
  geocode(query: GeocodeQuery): Promise<GeocodeResult | null>;
}

/**
 * Deterministic stub that hashes the address into the Nairobi bbox.
 */
export function createGoogleGeocoderStub(): GoogleGeocoder {
  return Object.freeze({
    provider: 'google' as const,
    async geocode(query: GeocodeQuery): Promise<GeocodeResult | null> {
      if (!query.address || query.address.trim().length === 0) {
        return null;
      }
      // Hash → deterministic offset within Nairobi bbox.
      const seed = hashString(query.address);
      const lon = 36.7 + ((seed % 1000) / 1000) * 0.2;
      const lat = -1.35 + (((seed >>> 10) % 1000) / 1000) * 0.2;
      return {
        provider: 'google',
        formattedAddress: query.address.trim(),
        point: { type: 'Point', coordinates: [round5(lon), round5(lat)] },
        confidence: 0.85,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Real HTTP adapter (Phase F).
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

/** Minimal `fetch` surface — lets tests inject a stub without DOM types. */
export type GoogleFetch = (
  input: string,
  init?: { readonly method?: string },
) => Promise<{ readonly ok: boolean; readonly status: number; json(): Promise<unknown> }>;

export interface GoogleGeocoderOpts {
  /** API key. Falls back to `GOOGLE_KG_API_KEY` then `GOOGLE_MAPS_API_KEY`. */
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly fetch?: GoogleFetch;
}

interface GoogleGeocodeResponse {
  readonly status: string; // 'OK' | 'ZERO_RESULTS' | 'OVER_QUERY_LIMIT' | ...
  readonly error_message?: string;
  readonly results?: ReadonlyArray<GoogleGeocodeRow>;
}

interface GoogleGeocodeRow {
  readonly formatted_address?: string;
  readonly geometry?: {
    readonly location?: { readonly lat?: number; readonly lng?: number };
    readonly location_type?: string;
  };
}

/**
 * Real Google adapter. Returns `null` for `ZERO_RESULTS` so the chain
 * continues. Throws on `OVER_QUERY_LIMIT` and `REQUEST_DENIED` so the
 * chain's per-adapter try/catch logs and moves on.
 */
export function createGoogleGeocoder(opts: GoogleGeocoderOpts = {}): GoogleGeocoder {
  const apiKey =
    opts.apiKey ??
    readEnv('GOOGLE_KG_API_KEY') ??
    readEnv('GOOGLE_MAPS_API_KEY');
  if (!apiKey) {
    throw new Error(
      'createGoogleGeocoder: missing API key. Set GOOGLE_KG_API_KEY (or GOOGLE_MAPS_API_KEY) or pass opts.apiKey.',
    );
  }
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  const fetcher: GoogleFetch | undefined =
    opts.fetch ?? (globalThis as { fetch?: GoogleFetch }).fetch;
  if (!fetcher) {
    throw new Error(
      'createGoogleGeocoder: no `fetch` available. Provide opts.fetch or run on Node>=18.',
    );
  }

  return Object.freeze({
    provider: 'google' as const,
    async geocode(query: GeocodeQuery): Promise<GeocodeResult | null> {
      const address = (query.address ?? '').trim();
      if (!address) return null;
      const params = new URLSearchParams({ address, key: apiKey });
      const url = `${baseUrl}?${params.toString()}`;
      const res = await fetcher(url, { method: 'GET' });
      if (!res.ok) {
        throw new Error(`google geocode: HTTP ${res.status} for "${address}"`);
      }
      const body = (await res.json()) as GoogleGeocodeResponse;
      const status = body?.status;
      if (status === 'ZERO_RESULTS') return null;
      if (status !== 'OK') {
        throw new Error(
          `google geocode: status=${status ?? 'unknown'} ${body?.error_message ?? ''}`.trim(),
        );
      }
      const row = body.results?.[0];
      const loc = row?.geometry?.location;
      const lat = loc?.lat;
      const lng = loc?.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      // Google reports a `location_type` we can map to confidence:
      //   ROOFTOP        → 0.95
      //   RANGE_INTERPOLATED → 0.85
      //   GEOMETRIC_CENTER   → 0.75
      //   APPROXIMATE        → 0.5
      const locType = row?.geometry?.location_type;
      const confidence = mapLocationTypeToConfidence(locType);
      return {
        provider: 'google',
        formattedAddress: row?.formatted_address ?? address,
        point: { type: 'Point', coordinates: [round5(lng as number), round5(lat as number)] },
        confidence,
      };
    },
  });
}

function mapLocationTypeToConfidence(locType?: string): number {
  switch (locType) {
    case 'ROOFTOP':
      return 0.95;
    case 'RANGE_INTERPOLATED':
      return 0.85;
    case 'GEOMETRIC_CENTER':
      return 0.75;
    case 'APPROXIMATE':
      return 0.5;
    default:
      return 0.7;
  }
}

function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  return env?.[name];
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
