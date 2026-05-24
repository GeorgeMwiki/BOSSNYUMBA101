/**
 * Google Maps Geocoding adapter — Phase F: live REST call against
 * `https://maps.googleapis.com/maps/api/geocode/json`. Phase E.5 (this
 * scaffold) ships a **deterministic stub** so tests + composition
 * wiring can run without `GOOGLE_MAPS_API_KEY` set.
 *
 * Spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md` §8.
 *
 * Env vars consumed:
 *   - `GOOGLE_MAPS_API_KEY` — required in Phase F; ignored by the stub.
 */
import type { GeocodeQuery, GeocodeResult } from '../_spatial-engine-shim.js';

export interface GoogleGeocoder {
  readonly provider: 'google';
  geocode(query: GeocodeQuery): Promise<GeocodeResult | null>;
}

/**
 * Deterministic stub that hashes the address into the
 * Nairobi bounding box. Phase F replaces this with a real fetch.
 */
export function createGoogleGeocoderStub(): GoogleGeocoder {
  return Object.freeze({
    provider: 'google' as const,
    async geocode(query: GeocodeQuery): Promise<GeocodeResult | null> {
      if (!query.address || query.address.trim().length === 0) {
        return null;
      }
      // Hash → deterministic offset within Nairobi bbox
      // (36.7..36.9 lon, -1.35..-1.15 lat).
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
