/**
 * Geocoder chain — Google → Plus Codes → what3words → Nominatim.
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
 * Env vars consumed (Phase F — stubs ignore them):
 *   - `GOOGLE_MAPS_API_KEY`
 *   - `WHAT3WORDS_API_KEY`
 */
import type { GeocodeQuery, GeocodeResult } from '../_spatial-engine-shim.js';
import type { GoogleGeocoder } from './google.js';
import { createGoogleGeocoderStub } from './google.js';
import type { PlusCodesGeocoder } from './plus-codes.js';
import { createPlusCodesStub } from './plus-codes.js';
import type { What3WordsGeocoder } from './what3words.js';
import { createWhat3WordsStub } from './what3words.js';
import type { NominatimGeocoder } from './nominatim.js';
import { createNominatimStub } from './nominatim.js';

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
}

export interface GeocoderChain {
  geocode(query: GeocodeQuery): Promise<GeocodeResult | null>;
  readonly providers: ReadonlyArray<string>;
}

/**
 * Build a chain with the four default stubs (Phase E.5). Composition
 * roots in Phase F inject real adapter instances.
 */
export function createDefaultGeocoderChain(
  deps: GeocoderChainDeps = {},
): GeocoderChain {
  const chain: ReadonlyArray<GeocoderAdapter> = [
    deps.google ?? createGoogleGeocoderStub(),
    deps.plusCodes ?? createPlusCodesStub(),
    deps.what3words ?? createWhat3WordsStub(),
    deps.nominatim ?? createNominatimStub(),
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

function sanitizeQuery(query: GeocodeQuery): GeocodeQuery | null {
  if (!query || typeof query.address !== 'string') return null;
  const address = query.address.trim();
  if (!address) return null;
  const next: GeocodeQuery = query.countryCode
    ? { address, countryCode: query.countryCode }
    : { address };
  return next;
}
