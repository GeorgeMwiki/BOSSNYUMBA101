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
import { z } from 'zod';
import { snapNearest } from '../snap/nearest-building.js';
import type { SnapCandidateSource } from '../snap/nearest-building.js';
import type { TenantResolver } from './parcels.js';

import { withSecurityEventsFastify } from '@bossnyumba/observability';

const SnapBodySchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  radiusM: z.number().finite().positive().optional(),
});
export interface SnapRouteDeps {
  readonly source: SnapCandidateSource;
  /**
   * Authenticates the inbound request. REQUIRED in production. Same
   * pattern as `parcels.ts` so a single composition root can wire one
   * JWT-derived resolver across every parcel-service route.
   */
  readonly tenantResolver?: TenantResolver;
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
    const parsed = SnapBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return {
        error: 'lat in [-90, 90], lng in [-180, 180] required (numbers)',
        details: parsed.error.flatten(),
      };
    }
    const { lat, lng, radiusM } = parsed.data;

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
