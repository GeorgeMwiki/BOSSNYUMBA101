/**
 * `POST /geocode` — chain-of-providers address lookup.
 *
 * Body shape:
 *   `{ "address": "Plot 42 Westlands, Nairobi", "countryCode": "KE"? }`
 *
 * Response shape (success):
 *   `{ "lat": -1.27, "lng": 36.81, "source": "google",
 *      "accuracyM": 5, "formattedAddress": "...", "confidence": 0.85 }`
 *
 * Spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md` §8.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { GeocoderChain } from '../geocoder/chain.js';
import type { TenantResolver } from './parcels.js';

import { withSecurityEventsFastify } from '@bossnyumba/observability';

const GeocodeBodySchema = z.object({
  address: z.string().trim().min(1).max(512),
  countryCode: z.string().trim().min(2).max(3).optional(),
});
export interface GeocodeRouteDeps {
  readonly chain: GeocoderChain;
  /**
   * Authenticates the inbound request. REQUIRED in production. When
   * omitted, the route trusts the caller — DEV/TEST ONLY. Mirrors the
   * pattern used by `parcels.ts` so a single composition root can wire
   * the same JWT-derived resolver across every parcel-service route.
   */
  readonly tenantResolver?: TenantResolver;
}

/**
 * Provider-specific confidence is also surfaced as a rough accuracy in
 * metres so the parcel-table `accuracyM` column can be populated even
 * when the upstream geocoder doesn't report it explicitly.
 */
function confidenceToAccuracyM(confidence: number): number {
  // 0.85 → 5 m, 0.5 → 50 m, 0.0 → 100 m (linear-ish bucket).
  if (confidence >= 0.85) return 5;
  if (confidence >= 0.75) return 15;
  if (confidence >= 0.5) return 50;
  return 100;
}

export async function registerGeocodeRoutes(
  app: FastifyInstance,
  deps: GeocodeRouteDeps,
): Promise<void> {
  const { tenantResolver } = deps;

  app.post('/geocode', withSecurityEventsFastify({ action: 'geocode.create', resource: 'geocode', severity: 'info' }, async (request, reply) => {
    // Auth gate — same pattern as parcels.ts. Geocode itself is
    // stateless but we still require an authenticated principal so
    // the upstream provider quota isn't burned by anonymous callers.
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
    const parsed = GeocodeBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return { error: 'body.address required (string)', details: parsed.error.flatten() };
    }
    const { address, countryCode } = parsed.data;
    const result = await deps.chain.geocode({
      address,
      ...(countryCode !== undefined ? { countryCode } : {}),
    });
    if (!result) {
      reply.code(404);
      return { error: 'no provider could resolve this address' };
    }
    const [lng, lat] = result.point.coordinates;
    return {
      lat,
      lng,
      source: result.provider,
      accuracyM: confidenceToAccuracyM(result.confidence),
      formattedAddress: result.formattedAddress,
      confidence: result.confidence,
    };
  }));
}
