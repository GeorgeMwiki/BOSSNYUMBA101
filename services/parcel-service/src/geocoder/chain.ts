/**
 * Geocoder chain.
 *
 * Ordering (per task spec): try Google (if key present) → Nominatim →
 * Plus Codes (stub) → what3words (stub). Return on first success.
 *
 * Spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md` §8
 * (decision: layered geocoder service in `services/parcel-service`).
 *
 * Behaviour:
 *   - Returns the FIRST non-null result.
 *   - If every adapter returns null, the chain returns null.
 *   - Adapter errors are caught and logged; the chain continues to the
 *     next provider so a single rate-limit upstream never blocks the
 *     full flow.
 *
 * Env vars consumed by the default factory:
 *   - `GOOGLE_KG_API_KEY` (or `GOOGLE_MAPS_API_KEY`) — when present, the
 *     real Google adapter is wired in; otherwise the Google stub.
 *   - `LIVE_GEOCODERS=1` — when set, swap the Nominatim stub for the
 *     real HTTP adapter. Default off so unit tests stay offline.
 *   - `WHAT3WORDS_API_KEY` — reserved for the (still-stubbed) what3words
 *     adapter once a real impl ships.
 */
import type { GeocodeQuery, GeocodeResult } from '../_spatial-engine-shim.js';
import type { GoogleGeocoder } from './google.js';
import { createGoogleGeocoder, createGoogleGeocoderStub } from './google.js';
import type { PlusCodesGeocoder } from './plus-codes.js';
import { createPlusCodesStub } from './plus-codes.js';
import type { What3WordsGeocoder } from './what3words.js';
import { createWhat3WordsStub } from './what3words.js';
import type { NominatimGeocoder } from './nominatim.js';
import { createNominatimGeocoder, createNominatimStub } from './nominatim.js';

export interface GeocoderAdapter {
  readonly provider: GeocodeResult['provider'];
  geocode(query: GeocodeQuery): Promise<GeocodeResult | null>;
}

export interface GeocoderChainDeps {
  readonly google?: GoogleGeocoder;
  readonly plusCodes?: PlusCodesGeocoder;
  readonly what3words?: What3WordsGeocoder;
  readonly nominatim?: NominatimGeocoder;
  /** Optional logger; we default to noop so tests stay silent. */
  readonly onError?: (provider: string, err: unknown) => void;
  /**
   * Force the all-stub chain regardless of env. Useful for tests that
   * want to assert the wiring order without any real HTTP calls.
   * Default `false` — the factory inspects env.
   */
  readonly forceStubs?: boolean;
}

export interface GeocoderChain {
  geocode(query: GeocodeQuery): Promise<GeocodeResult | null>;
  readonly providers: ReadonlyArray<string>;
}

/**
 * Build the default chain. Env-aware:
 *   - With a Google key → real Google first. Without a key → Google stub.
 *   - With `LIVE_GEOCODERS=1` → real Nominatim second. Otherwise → stub.
 *   - Plus Codes + what3words are stubs (see their module docstrings).
 *
 * Callers wanting deterministic in-process behaviour (e.g. unit tests)
 * pass `forceStubs: true` to short-circuit env inspection.
 */
export function createDefaultGeocoderChain(
  deps: GeocoderChainDeps = {},
): GeocoderChain {
  const stubsOnly = deps.forceStubs === true;
  const googleAdapter = deps.google ?? selectGoogleAdapter(stubsOnly);
  const nominatimAdapter = deps.nominatim ?? selectNominatimAdapter(stubsOnly);

  // Order per task spec: Google → Nominatim → Plus Codes → what3words.
  const chain: ReadonlyArray<GeocoderAdapter> = [
    googleAdapter,
    nominatimAdapter,
    deps.plusCodes ?? createPlusCodesStub(),
    deps.what3words ?? createWhat3WordsStub(),
  ];
  return createGeocoderChain(chain, deps.onError);
}

export function createGeocoderChain(
  chain: ReadonlyArray<GeocoderAdapter>,
  onError?: (provider: string, err: unknown) => void,
): GeocoderChain {
  return Object.freeze({
    providers: chain.map((c) => c.provider),
    async geocode(query: GeocodeQuery): Promise<GeocodeResult | null> {
      const sanitized = sanitizeQuery(query);
      if (!sanitized) return null;
      for (const adapter of chain) {
        try {
          const result = await adapter.geocode(sanitized);
          if (result) return result;
        } catch (err) {
          if (onError) onError(adapter.provider, err);
        }
      }
      return null;
    },
  });
}

function selectGoogleAdapter(stubsOnly: boolean): GoogleGeocoder {
  if (stubsOnly) return createGoogleGeocoderStub();
  const key = readEnv('GOOGLE_KG_API_KEY') ?? readEnv('GOOGLE_MAPS_API_KEY');
  if (!key) return createGoogleGeocoderStub();
  try {
    return createGoogleGeocoder({ apiKey: key });
  } catch {
    return createGoogleGeocoderStub();
  }
}

function selectNominatimAdapter(stubsOnly: boolean): NominatimGeocoder {
  if (stubsOnly) return createNominatimStub();
  if (!isLiveGeocodersEnabled()) return createNominatimStub();
  try {
    return createNominatimGeocoder();
  } catch {
    return createNominatimStub();
  }
}

function isLiveGeocodersEnabled(): boolean {
  const v = readEnv('LIVE_GEOCODERS');
  if (!v) return false;
  const norm = v.trim().toLowerCase();
  return norm === '1' || norm === 'true' || norm === 'yes' || norm === 'on';
}

function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  return env?.[name];
}

function sanitizeQuery(query: GeocodeQuery): GeocodeQuery | null {
  if (!query || typeof query.address !== 'string') return null;
  const address = query.address.trim();
  if (!address) return null;
  const next: GeocodeQuery = query.countryCode
    ? { address, countryCode: query.countryCode }
    : { address };
  return next;
}
