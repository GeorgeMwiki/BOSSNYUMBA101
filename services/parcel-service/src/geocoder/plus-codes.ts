/**
 * Plus Codes (Open Location Code) decoder.
 *
 * STATUS: STUB.
 *
 * Plus Codes is a coordinate ENCODER (lat/lng ↔ code), not a geocoder
 * over arbitrary natural-language addresses. A real implementation
 * needs an upstream coordinate (typically from another geocoder) before
 * we can decode any context-free Plus Code to a precise lat/lng — short
 * codes like `5C+24` are meaningless without locality context. We keep
 * the stub for the chain wiring so the public surface is stable; the
 * real adapter ships when Plus-Code parcel issuance lands.
 *
 * Spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md` §8
 * (decision: always-also-store a Plus Code on every parcel row).
 */
import type { GeocodeQuery, GeocodeResult } from '@bossnyumba/spatial-engine';

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
