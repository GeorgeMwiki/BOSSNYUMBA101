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
import type { ParcelStore } from './routes/parcels.js';
import type { GeocoderChain } from './geocoder/chain.js';
import type { SnapCandidateSource } from './snap/nearest-building.js';

export interface BuildAppDeps {
  readonly store?: ParcelStore;
  readonly chain?: GeocoderChain;
  readonly snapSource?: SnapCandidateSource;
}

/**
 * Build a Fastify instance with all routes wired. Defaults Phase E.5
 * in-memory implementations; pass concrete deps from a composition
 * root to swap in PostGIS / live HTTP geocoders.
 */
export async function buildApp(deps: BuildAppDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  const store = deps.store ?? createInMemoryParcelStore();
  const chain = deps.chain ?? createDefaultGeocoderChain();
  const snapSource = deps.snapSource ?? createInMemoryCandidateSource([]);

  app.get('/healthz', async () => ({ status: 'ok', service: 'parcel-service' }));

  await registerParcelsRoutes(app, { store });
  await registerGeocodeRoutes(app, { chain });
  await registerSnapRoutes(app, { source: snapSource });

  return app;
}

async function main(): Promise<void> {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3017);
  const host = process.env.HOST ?? '0.0.0.0';
  try {
    await app.listen({ port, host });
    // eslint-disable-next-line no-console
    console.log(`[parcel-service] listening on http://${host}:${port}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[parcel-service] fatal:', err);
    process.exit(1);
  }
}

// Auto-start when invoked directly (`node dist/index.js`).
const invokedDirectly = (() => {
  try {
    if (!process.argv[1]) return false;
    const argvUrl = new URL(`file://${process.argv[1]}`).href;
    return import.meta.url === argvUrl;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  void main();
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
} from './routes/parcels.js';

export { registerGeocodeRoutes } from './routes/geocode.js';
export { registerSnapRoutes } from './routes/snap.js';

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
