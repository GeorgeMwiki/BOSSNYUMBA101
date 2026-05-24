/**
 * OpenStreetMap Nominatim adapter — Phase F: live REST call against a
 * self-hosted Nominatim (Stadia / Pelias for production scale). Phase
 * E.5 (this scaffold) ships a **deterministic last-resort stub** that
 * always resolves to a low-confidence point.
 *
 * Spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md` §8.
 */
import type { GeocodeQuery, GeocodeResult } from '../_spatial-engine-shim.js';

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
