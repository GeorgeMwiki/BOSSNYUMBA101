/**
 * what3words adapter — Phase F: live REST call against
 * `https://api.what3words.com/v3/convert-to-coordinates`. Phase E.5
 * (this scaffold) ships a **deterministic stub**.
 *
 * Spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md` §8.
 *
 * Env vars consumed:
 *   - `WHAT3WORDS_API_KEY` — required in Phase F; ignored by the stub.
 */
import type { GeocodeQuery, GeocodeResult } from '../_spatial-engine-shim.js';

export interface What3WordsGeocoder {
  readonly provider: 'what3words';
  geocode(query: GeocodeQuery): Promise<GeocodeResult | null>;
}

/**
 * Stub: only resolves three-dotted-word patterns
 * (e.g. `///filled.count.soap`). Other inputs return null so the chain
 * falls through to Nominatim.
 */
export function createWhat3WordsStub(): What3WordsGeocoder {
  return Object.freeze({
    provider: 'what3words' as const,
    async geocode(query: GeocodeQuery): Promise<GeocodeResult | null> {
      const words = extractTriplet(query.address);
      if (!words) return null;
      const seed = words.reduce(
        (acc, w) => (acc * 131 + hashString(w)) >>> 0,
        0,
      );
      const lon = 36.7 + ((seed % 1000) / 1000) * 0.2;
      const lat = -1.35 + (((seed >>> 10) % 1000) / 1000) * 0.2;
      return {
        provider: 'what3words',
        formattedAddress: `///${words.join('.')}`,
        point: { type: 'Point', coordinates: [round5(lon), round5(lat)] },
        confidence: 0.75,
      };
    },
  });
}

function extractTriplet(address: string): readonly string[] | null {
  if (!address) return null;
  const match = address.match(/(?:\/\/\/)?([a-z]+)\.([a-z]+)\.([a-z]+)/i);
  if (!match) return null;
  return [match[1]!.toLowerCase(), match[2]!.toLowerCase(), match[3]!.toLowerCase()];
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
