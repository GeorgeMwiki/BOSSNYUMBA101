/**
 * Snap helper — thin wrapper over
 * `@bossnyumba/spatial-engine#snapToNearestBuilding` that adds the
 * service-level concern of *fetching* candidates (PostGIS in Phase F,
 * in-memory reference list in Phase E.5).
 *
 * Spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md` §6
 * + Part E §3 ("snap-to-nearest-building endpoint" — returns top
 * candidate within 25 m, with confidence).
 *
 * Env vars consumed (Phase F):
 *   - `PARCEL_DB_URL` — PostGIS connection string for candidate fetch.
 */
import {
  DEFAULT_SNAP_RADIUS_M,
  snapToNearestBuilding,
} from '../_spatial-engine-shim.js';
import type {
  GeoJsonPoint,
  ReferenceBuilding,
  SnapResult,
} from '../_spatial-engine-shim.js';

export interface SnapCandidateSource {
  /** Fetch candidate buildings inside a bbox around `point` (radiusM). */
  fetchCandidates(
    point: GeoJsonPoint,
    radiusM: number,
  ): Promise<ReadonlyArray<ReferenceBuilding>>;
}

/**
 * In-memory candidate source — Phase E.5 default. Pass a frozen list
 * (e.g. a small pre-loaded Overture sample) and the service will use
 * it for all snap queries. Phase F swaps this for a PostGIS adapter.
 */
export function createInMemoryCandidateSource(
  refs: ReadonlyArray<ReferenceBuilding>,
): SnapCandidateSource {
  const frozen = Object.freeze([...refs]);
  return Object.freeze({
    async fetchCandidates(): Promise<ReadonlyArray<ReferenceBuilding>> {
      return frozen;
    },
  });
}

export interface SnapNearestRequest {
  readonly point: GeoJsonPoint;
  readonly radiusM?: number;
}

/**
 * Snap a query point to the nearest candidate footprint.
 *
 * Returns `null` when no candidate is within `radiusM` (default 25 m
 * per spec §6 / DEFAULT_SNAP_RADIUS_M).
 */
export async function snapNearest(
  req: SnapNearestRequest,
  source: SnapCandidateSource,
): Promise<SnapResult | null> {
  if (!isValidPoint(req?.point)) return null;
  const requested = req.radiusM;
  const radiusM =
    typeof requested === 'number' && Number.isFinite(requested) && requested > 0
      ? requested
      : DEFAULT_SNAP_RADIUS_M;

  const candidates = await source.fetchCandidates(req.point, radiusM);
  return snapToNearestBuilding(req.point, candidates, radiusM);
}

function isValidPoint(p: unknown): p is GeoJsonPoint {
  if (!p || typeof p !== 'object') return false;
  const point = p as { type?: unknown; coordinates?: unknown };
  if (point.type !== 'Point') return false;
  const coords = point.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return false;
  const lon = coords[0];
  const lat = coords[1];
  if (typeof lon !== 'number' || typeof lat !== 'number') return false;
  return (
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    Math.abs(lon) <= 180 &&
    Math.abs(lat) <= 90
  );
}
