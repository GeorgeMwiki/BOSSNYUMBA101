/**
 * @bossnyumba/parcel-service — Fastify HTTP entrypoint + barrel
 * exports for the composition root.
 *
 * Wires:
 *   - GET    /healthz
 *   - GET    /parcels                    (X-Tenant-Id header)
 *   - GET    /parcels/:id                (X-Tenant-Id header)
 *   - POST   /parcels                    (X-Tenant-Id header)
 *   - PATCH  /parcels/:id                (X-Tenant-Id header)
 *   - DELETE /parcels/:id                (X-Tenant-Id header)
 *   - POST   /geocode                    { address, countryCode? }
 *   - POST   /snap-to-nearest-building   { lat, lng, radiusM? }
 *
 * Spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md`
 * Part E §3 + §H ("services/parcel-service — I/O: REST + Martin +
 * PostGIS + geocoder chain").
 *
 * Env vars consumed:
 *   - `PORT`                  — Fastify listen port (default 3017)
 *   - `HOST`                  — Fastify listen host (default 0.0.0.0)
 *   - `GOOGLE_MAPS_API_KEY`   — Phase F: geocoder/google.ts
 *   - `WHAT3WORDS_API_KEY`    — Phase F: geocoder/what3words.ts
 *   - `PARCEL_DB_URL`         — Phase F: PostGIS connection string
 *   - `MCP_TENANT_ALLOWLIST`  — JSON `{"parcel": ["t1","t2"]}` per-tenant guard
 */
import { pathToFileURL } from 'url';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { createDefaultGeocoderChain } from './geocoder/chain.js';
import { createInMemoryCandidateSource } from './snap/nearest-building.js';
import {
  createInMemoryParcelStore,
  registerParcelsRoutes,
} from './routes/parcels.js';
import { registerGeocodeRoutes } from './routes/geocode.js';
import { registerSnapRoutes } from './routes/snap.js';
import type { ParcelStore, TenantResolver } from './routes/parcels.js';
import type { GeocoderChain } from './geocoder/chain.js';
import type { SnapCandidateSource } from './snap/nearest-building.js';
import { logger } from './logger.js';

export interface BuildAppDeps {
  readonly store?: ParcelStore;
  readonly chain?: GeocoderChain;
  readonly snapSource?: SnapCandidateSource;
  /**
   * Authenticates the inbound request and returns the tenant id it is
   * allowed to operate on. REQUIRED in production. When omitted the
   * routes fall back to the legacy `X-Tenant-Id` header — DEV-ONLY.
   */
  readonly tenantResolver?: TenantResolver;
  /**
   * Test-only escape hatch. Set to true in tests that need the
   * legacy header-trust path; production deploys must wire a real
   * `tenantResolver` AND leave this `false`.
   */
  readonly allowHeaderFallback?: boolean;
}

/**
 * Build a Fastify instance with all routes wired. Defaults Phase E.5
 * in-memory implementations; pass concrete deps from a composition
 * root to swap in PostGIS / live HTTP geocoders.
 *
 * Bug-sweep 2026-05-24 — when running with `NODE_ENV=production` AND
 * no `tenantResolver` is wired AND `allowHeaderFallback` is not
 * explicitly true, this function throws to prevent accidentally
 * shipping a tenant-spoofable surface.
 */
export async function buildApp(deps: BuildAppDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  const store = deps.store ?? createInMemoryParcelStore();
  const chain = deps.chain ?? createDefaultGeocoderChain();
  const snapSource = deps.snapSource ?? createInMemoryCandidateSource([]);

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !deps.tenantResolver && deps.allowHeaderFallback !== true) {
    throw new Error(
      'parcel-service: refusing to start in production without a tenantResolver — ' +
        'wire deps.tenantResolver from the composition root (auth middleware) ' +
        'or explicitly pass allowHeaderFallback=true (NOT RECOMMENDED).',
    );
  }

  app.get('/healthz', async () => ({ status: 'ok', service: 'parcel-service' }));

  await registerParcelsRoutes(app, {
    store,
    ...(deps.tenantResolver ? { tenantResolver: deps.tenantResolver } : {}),
    ...(deps.allowHeaderFallback !== undefined
      ? { allowHeaderFallback: deps.allowHeaderFallback }
      : {}),
  });
  await registerGeocodeRoutes(app, {
    chain,
    ...(deps.tenantResolver ? { tenantResolver: deps.tenantResolver } : {}),
  });
  await registerSnapRoutes(app, {
    source: snapSource,
    ...(deps.tenantResolver ? { tenantResolver: deps.tenantResolver } : {}),
  });

  return app;
}

async function main(): Promise<void> {
  // Build via the composition root so the standalone pod boots with a
  // real JWT tenant resolver (or fails fast with an actionable message
  // when no JWT secret is configured in production). The bare
  // `buildApp()` would hit the production tenant-spoof guard and
  // crash-loop. See `composition/build-app.ts`.
  const { buildProductionApp } = await import('./composition/build-app.js');
  const app = await buildProductionApp();
  const port = Number(process.env.PORT ?? 3017);
  const host = process.env.HOST ?? '0.0.0.0';
  try {
    await app.listen({ port, host });
    logger.info(`[parcel-service] listening on http://${host}:${port}`);
  } catch (err) {
    logger.error('[parcel-service] fatal', { error: err });
    process.exit(1);
  }
}

// Auto-start when invoked directly (`node dist/index.js`).
//
// P84 audit (carries forward P76 BUG-HI-5 + BUG-HI-6 patterns):
//   - `new URL(\`file://${process.argv[1]}\`)` does NOT percent-encode
//     spaces; on dev paths with spaces the URL constructor either
//     throws or produces a mismatched href and main() never fires.
//     `pathToFileURL` handles encoding correctly.
//   - bare `void main()` discards the promise — any synchronous reject
//     before listen() bubbles up as UnhandledPromiseRejection. Match
//     apollo-gauntlet-runner's `.catch` + process.exit pattern.
const invokedDirectly = (() => {
  try {
    const entry = process.argv[1];
    if (typeof entry !== 'string' || entry.length === 0) return false;
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  void main().catch((err) => {
    logger.error('[parcel-service] unhandled fatal', { error: err });
    process.exit(1);
  });
}

// ---------------------------------------------------------------------------
// Public barrel
// ---------------------------------------------------------------------------

export {
  createInMemoryParcelStore,
  registerParcelsRoutes,
} from './routes/parcels.js';
export type {
  ParcelStore,
  CreateParcelInput,
  PatchParcelInput,
  TenantResolver,
} from './routes/parcels.js';

export { registerGeocodeRoutes } from './routes/geocode.js';
export { registerSnapRoutes } from './routes/snap.js';

// NOTE: the composition root (`composition/build-app.ts`) is intentionally
// NOT re-exported from this barrel. It is loaded only via the dynamic
// `await import()` inside `main()` (and directly by tests), mirroring
// `services/outcomes-metering` — keeping it out of the static export graph
// avoids the index ↔ build-app circular-import eager-evaluation hazard.

export {
  createDefaultGeocoderChain,
  createGeocoderChain,
} from './geocoder/chain.js';
export type {
  GeocoderChain,
  GeocoderAdapter,
  GeocoderChainDeps,
} from './geocoder/chain.js';

export {
  createGoogleGeocoder,
  createGoogleGeocoderStub,
} from './geocoder/google.js';
export type {
  GoogleGeocoder,
  GoogleGeocoderOpts,
  GoogleFetch,
} from './geocoder/google.js';

export {
  createNominatimGeocoder,
  createNominatimStub,
} from './geocoder/nominatim.js';
export type {
  NominatimGeocoder,
  NominatimGeocoderOpts,
  NominatimFetch,
} from './geocoder/nominatim.js';

export {
  snapNearest,
  createInMemoryCandidateSource,
} from './snap/nearest-building.js';
export type {
  SnapCandidateSource,
  SnapNearestRequest,
} from './snap/nearest-building.js';

export {
  createParcelMcpServer,
  listParcelMcpTools,
  runStdio as runParcelMcpStdio,
} from './mcp/parcel-mcp-server.js';
export type {
  ParcelMcpDeps,
  ParcelMcpServerConfig,
  ParcelMcpServerHandle,
} from './mcp/parcel-mcp-server.js';
