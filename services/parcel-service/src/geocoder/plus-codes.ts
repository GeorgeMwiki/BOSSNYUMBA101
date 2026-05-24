/**
 * Plus Codes (Open Location Code) decoder — converts a Google-issued
 * Plus Code such as `6GCRPR5C+24` or `Nairobi 6GCRPR5C+24` into a
 * point. Phase F: drop in the official `open-location-code` npm
 * package. Phase E.5 (this scaffold) ships a deterministic stub that
 * decodes a *very* narrow surface so unit tests can assert wiring.
 *
 * Spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md` §8
 * (decision: always-also-store a Plus Code on every parcel row).
 */
import type { GeocodeQuery, GeocodeResult } from '../_spatial-engine-shim.js';

export interface PlusCodesGeocoder {
  readonly provider: 'plus_codes';
  geocode(query: GeocodeQuery): Promise<GeocodeResult | null>;
}

/**
 * Stub: detects `+` in the address and decodes the first 8 characters
 * as a coarse offset around Nairobi. Real implementation in Phase F.
 */
export function createPlusCodesStub(): PlusCodesGeocoder {
  return Object.freeze({
    provider: 'plus_codes' as const,
    async geocode(query: GeocodeQuery): Promise<GeocodeResult | null> {
      const code = extractPlusCode(query.address);
      if (!code) return null;
      const seed = code
        .split('')
        .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 0);
      const lon = 36.7 + ((seed % 1000) / 1000) * 0.2;
      const lat = -1.35 + (((seed >>> 10) % 1000) / 1000) * 0.2;
      return {
        provider: 'plus_codes',
        formattedAddress: code,
        point: { type: 'Point', coordinates: [round5(lon), round5(lat)] },
        confidence: 0.8,
      };
    },
  });
}

function extractPlusCode(address: string): string | null {
  if (!address) return null;
  const match = address.match(/[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}/i);
  return match ? match[0].toUpperCase() : null;
}

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}
