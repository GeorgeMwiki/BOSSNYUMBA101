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
import type { GeocoderChain } from '../geocoder/chain.js';

export interface GeocodeRouteDeps {
  readonly chain: GeocoderChain;
}

interface GeocodeBody {
  readonly address?: unknown;
  readonly countryCode?: unknown;
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
  app.post('/geocode', async (request, reply) => {
    const body = (request.body ?? {}) as GeocodeBody;
    if (typeof body.address !== 'string' || body.address.trim().length === 0) {
      reply.code(400);
      return { error: 'body.address required (string)' };
    }
    const result = await deps.chain.geocode({
      address: body.address,
      ...(typeof body.countryCode === 'string'
        ? { countryCode: body.countryCode }
        : {}),
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
  });
}
