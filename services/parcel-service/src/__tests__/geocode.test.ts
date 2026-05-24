/**
 * geocode.test.ts — exercises:
 *   1. createDefaultGeocoderChain ordering (Google first when a plain
 *      address is supplied).
 *   2. Fallback to Plus Codes when Google adapter returns null.
 *   3. Error containment — a throwing adapter does NOT poison the
 *      chain; the next adapter still runs.
 *   4. POST /geocode HTTP route happy + sad paths.
 */
import { describe, expect, it } from 'vitest';
import { buildApp } from '../index.js';
import {
  createDefaultGeocoderChain,
  createGeocoderChain,
} from '../geocoder/chain.js';
import type { GeocoderAdapter } from '../geocoder/chain.js';

describe('geocoder chain', () => {
  it('runs Google → Nominatim → PlusCodes → what3words by default', () => {
    const chain = createDefaultGeocoderChain();
    expect(chain.providers).toEqual([
      'google',
      'nominatim',
      'plus_codes',
      'what3words',
    ]);
  });

  it('returns the first non-null adapter result', async () => {
    const adapters: ReadonlyArray<GeocoderAdapter> = [
      {
        provider: 'google',
        async geocode() {
          return null; // skip
        },
      },
      {
        provider: 'plus_codes',
        async geocode() {
          return {
            provider: 'plus_codes',
            formattedAddress: 'STUB',
            point: { type: 'Point', coordinates: [36.81, -1.27] },
            confidence: 0.9,
          };
        },
      },
      {
        provider: 'what3words',
        async geocode() {
          throw new Error('should not be called');
        },
      },
    ];
    const chain = createGeocoderChain(adapters);
    const result = await chain.geocode({ address: 'anything' });
    expect(result?.provider).toBe('plus_codes');
    expect(result?.confidence).toBe(0.9);
  });

  it('isolates adapter errors — chain continues past a thrown provider', async () => {
    const errors: string[] = [];
    const adapters: ReadonlyArray<GeocoderAdapter> = [
      {
        provider: 'google',
        async geocode() {
          throw new Error('rate limit');
        },
      },
      {
        provider: 'nominatim',
        async geocode() {
          return {
            provider: 'nominatim',
            formattedAddress: 'FALLBACK',
            point: { type: 'Point', coordinates: [0, 0] },
            confidence: 0.5,
          };
        },
      },
    ];
    const chain = createGeocoderChain(adapters, (p, e) => {
      errors.push(`${p}:${(e as Error).message}`);
    });
    const result = await chain.geocode({ address: 'fallback test' });
    expect(result?.provider).toBe('nominatim');
    expect(errors).toEqual(['google:rate limit']);
  });

  it('returns null for empty / non-string addresses', async () => {
    const chain = createDefaultGeocoderChain();
    expect(await chain.geocode({ address: '' })).toBeNull();
    expect(
      await chain.geocode({ address: '   ' as string }),
    ).toBeNull();
  });
});

describe('POST /geocode', () => {
  it('resolves an address to lat/lng via the default chain', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/geocode',
      payload: { address: 'Plot 42 Westlands Nairobi' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      lat: number;
      lng: number;
      source: string;
      accuracyM: number;
    };
    expect(body.source).toBe('google');
    expect(body.lat).toBeGreaterThanOrEqual(-90);
    expect(body.lat).toBeLessThanOrEqual(90);
    expect(body.lng).toBeGreaterThanOrEqual(-180);
    expect(body.lng).toBeLessThanOrEqual(180);
    expect(body.accuracyM).toBeGreaterThan(0);
    await app.close();
  });

  it('rejects missing address with 400', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/geocode',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('is deterministic — same address produces same coordinates', async () => {
    const app = await buildApp();
    const r1 = await app.inject({
      method: 'POST',
      url: '/geocode',
      payload: { address: 'Same Place, Nairobi' },
    });
    const r2 = await app.inject({
      method: 'POST',
      url: '/geocode',
      payload: { address: 'Same Place, Nairobi' },
    });
    expect(r1.json()).toEqual(r2.json());
    await app.close();
  });
});
