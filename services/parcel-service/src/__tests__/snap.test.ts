/**
 * snap.test.ts — exercises snapNearest + POST /snap-to-nearest-building:
 *   1. Returns the closest candidate within radiusM.
 *   2. Returns null / 404 when nothing is in range.
 *   3. Rejects invalid lat/lng with 400.
 *   4. Defaults to 25 m radius (DEFAULT_SNAP_RADIUS_M from spatial-engine).
 */
import { describe, expect, it } from 'vitest';
import {
  createInMemoryCandidateSource,
  snapNearest,
} from '../snap/nearest-building.js';
import { buildApp } from '../index.js';
import type { ReferenceBuilding } from '@bossnyumba/spatial-engine';

function makeBuilding(
  id: string,
  centerLon: number,
  centerLat: number,
): ReferenceBuilding {
  // ~10 m square footprint centred on (centerLon, centerLat).
  const halfDeg = 5 / 111_320; // ~5 m in degrees of latitude
  return Object.freeze({
    id,
    source: 'overture',
    footprint: {
      type: 'Polygon',
      coordinates: [
        [
          [centerLon - halfDeg, centerLat - halfDeg],
          [centerLon + halfDeg, centerLat - halfDeg],
          [centerLon + halfDeg, centerLat + halfDeg],
          [centerLon - halfDeg, centerLat + halfDeg],
          [centerLon - halfDeg, centerLat - halfDeg],
        ],
      ],
    },
  });
}

describe('snapNearest', () => {
  it('returns the closer of two candidates', async () => {
    const near = makeBuilding('near', 36.8100, -1.2700);
    const far = makeBuilding('far', 36.8101, -1.2700);
    const source = createInMemoryCandidateSource([far, near]);
    const result = await snapNearest(
      { point: { type: 'Point', coordinates: [36.8100, -1.2700] } },
      source,
    );
    expect(result?.building.id).toBe('near');
    expect(result?.distanceM).toBeLessThan(5);
  });

  it('returns null when no candidate is within radiusM', async () => {
    const far = makeBuilding('far', 36.85, -1.27);
    const source = createInMemoryCandidateSource([far]);
    const result = await snapNearest(
      {
        point: { type: 'Point', coordinates: [36.8100, -1.2700] },
        radiusM: 25,
      },
      source,
    );
    expect(result).toBeNull();
  });

  it('rejects invalid points', async () => {
    const source = createInMemoryCandidateSource([
      makeBuilding('only', 36.81, -1.27),
    ]);
    const bad = await snapNearest(
      {
        point: { type: 'Point', coordinates: [999, 999] } as never,
      },
      source,
    );
    expect(bad).toBeNull();
  });
});

describe('POST /snap-to-nearest-building', () => {
  it('returns the snapped footprint when a candidate is in range', async () => {
    const near = makeBuilding('near-http', 36.8100, -1.2700);
    const app = await buildApp({
      snapSource: createInMemoryCandidateSource([near]),
    });
    const res = await app.inject({
      method: 'POST',
      url: '/snap-to-nearest-building',
      payload: { lat: -1.27, lng: 36.81 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      buildingId: string;
      source: string;
      footprint: { type: string };
      distanceM: number;
    };
    expect(body.buildingId).toBe('near-http');
    expect(body.source).toBe('overture');
    expect(body.footprint.type).toBe('Polygon');
    expect(body.distanceM).toBeGreaterThanOrEqual(0);
    await app.close();
  });

  it('returns 404 when no candidate is in range', async () => {
    const app = await buildApp({
      snapSource: createInMemoryCandidateSource([
        makeBuilding('far', 36.9, -1.27),
      ]),
    });
    const res = await app.inject({
      method: 'POST',
      url: '/snap-to-nearest-building',
      payload: { lat: -1.27, lng: 36.81 },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('rejects out-of-range lat/lng with 400', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/snap-to-nearest-building',
      payload: { lat: 999, lng: 0 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects missing lat/lng with 400', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/snap-to-nearest-building',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
