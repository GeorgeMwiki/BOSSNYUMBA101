/**
 * `POST /snap-to-nearest-building` — snap a query point to the nearest
 * Overture / Google-Open-Buildings footprint within the snap radius
 * (default 25 m per spec §6 / DEFAULT_SNAP_RADIUS_M).
 *
 * Body shape:
 *   `{ "lat": -1.27, "lng": 36.81, "radiusM": 25? }`
 *
 * Response shape:
 *   - 200 `{ "footprint": GeoJsonPolygon, "source": "overture",
 *           "distanceM": 7.4, "buildingId": "..." }`
 *   - 404 `{ "error": "no candidate within radiusM" }`
 *
 * Spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md`
 * Part E §3.
 */
import type { FastifyInstance } from 'fastify';
import { snapNearest } from '../snap/nearest-building.js';
import type { SnapCandidateSource } from '../snap/nearest-building.js';
import type { TenantResolver } from './parcels.js';

import { withSecurityEventsFastify } from '@bossnyumba/observability';
export interface SnapRouteDeps {
  readonly source: SnapCandidateSource;
  /**
   * Authenticates the inbound request. REQUIRED in production. Same
   * pattern as `parcels.ts` so a single composition root can wire one
   * JWT-derived resolver across every parcel-service route.
   */
  readonly tenantResolver?: TenantResolver;
}

interface SnapBody {
  readonly lat?: unknown;
  readonly lng?: unknown;
  readonly radiusM?: unknown;
}

export async function registerSnapRoutes(
  app: FastifyInstance,
  deps: SnapRouteDeps,
): Promise<void> {
  const { tenantResolver } = deps;

  app.post('/snap-to-nearest-building', withSecurityEventsFastify({ action: 'parcel-snap.create', resource: 'parcel-snap', severity: 'info' }, async (request, reply) => {
    // Auth gate — same pattern as parcels.ts.
    if (tenantResolver) {
      try {
        const resolved = await tenantResolver.resolve(request);
        if (typeof resolved !== 'string' || resolved.length === 0) {
          reply.code(401);
          return { error: 'unauthorised' };
        }
      } catch {
        reply.code(401);
        return { error: 'unauthorised' };
      }
    } else if (process.env.NODE_ENV === 'production') {
      reply.code(401);
      return { error: 'unauthorised: no resolver wired' };
    }
    const body = (request.body ?? {}) as SnapBody;
    const lat = typeof body.lat === 'number' ? body.lat : NaN;
    const lng = typeof body.lng === 'number' ? body.lng : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      reply.code(400);
      return { error: 'lat + lng required (numbers)' };
    }
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      reply.code(400);
      return { error: 'lat in [-90, 90], lng in [-180, 180]' };
    }
    const radiusM =
      typeof body.radiusM === 'number' && body.radiusM > 0
        ? body.radiusM
        : undefined;

    const result = await snapNearest(
      {
        point: { type: 'Point', coordinates: [lng, lat] },
        ...(radiusM !== undefined ? { radiusM } : {}),
      },
      deps.source,
    );

    if (!result) {
      reply.code(404);
      return { error: 'no candidate within radiusM' };
    }

    return {
      buildingId: result.building.id,
      source: result.building.source,
      footprint: result.building.footprint,
      distanceM: result.distanceM,
    };
  }));
}
