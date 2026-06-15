/**
 * @bossnyumba/field-capture-service — Fastify HTTP entrypoint.
 *
 * Mobile-app-facing endpoints for field captures:
 *   POST /v1/field/capture/photo
 *   POST /v1/field/capture/video
 *   POST /v1/field/capture/audio
 *   POST /v1/field/capture/inspection
 *   POST /v1/field/capture/sync
 *   GET  /v1/field/queue/:surveyorId
 *   POST /v1/field/parcels/:id/polygon
 *   GET  /healthz
 *   GET  /readyz
 *   GET  /metrics
 *
 * Port 9020 (free; checked against existing 3017, 3018, 8080, 8000).
 *
 * Env vars:
 *   - `PORT`        — listen port (default 9020)
 *   - `HOST`        — listen host (default 0.0.0.0)
 *   - `NODE_ENV`    — production vs. dev gating
 *
 * Spec: Docs/requirements/VOICE_MEMO_2026-04-18_questionnaire_analysis.md §2-§3.
 */

import { pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import {
  createInMemoryCaptureStore,
  type CaptureStore,
} from '@bossnyumba/geo-intelligence';
import type { StorageAdapter } from '@bossnyumba/storage-adapter';
import { registerCaptureRoutes } from './routes/captures.js';
import { registerAuthHook, type TestAuthInjector } from './middleware/auth.js';
import { createMetrics, type MetricsHarness } from './metrics.js';
import { logger } from './logger.js';

export interface BuildAppDeps {
  /**
   * Capture RECORD store (queue / status / listing). When omitted,
   * `buildApp` falls back to `createInMemoryCaptureStore()` — a process-
   * local `Map` that is acceptable ONLY for dev/test. The production
   * entrypoint NEVER reaches that fallback: `buildProductionApp` (the sole
   * prod boot path) FAILS FAST when no durable store is wired, because an
   * in-memory store on `replicas: 2` silently loses records on restart and
   * desyncs across pods. See `composition/build-app.ts`.
   */
  readonly store?: CaptureStore;
  readonly metrics?: MetricsHarness;
  /**
   * Optional shared StorageAdapter port. When provided, inline base64
   * bytes received on capture routes are persisted through the
   * adapter at `<bucket>/<tenantId>/<captureId>` (see
   * `routes/captures.ts`). When omitted (default), inline bytes are
   * only hashed for C2PA — preserves prior behaviour for callers that
   * upload via a separate pre-signed flow.
   */
  readonly storageAdapter?: StorageAdapter;
  readonly kindToBucket?: (kind: string) => string;
  /**
   * Test-only: bypass JWT verification by stamping `request.user`
   * synchronously. Production never sets this — `buildApp({})` always
   * exercises the real JWT path. See `middleware/auth.ts`.
   */
  readonly testAuthInjector?: TestAuthInjector;
}

export async function buildApp(deps: BuildAppDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  // DEV/TEST fallback only — production reaches buildApp exclusively via
  // buildProductionApp, which fails fast before getting here when no
  // durable store is wired (an in-memory Map on replicas: 2 silently loses
  // and desyncs capture records). See composition/build-app.ts.
  const store = deps.store ?? createInMemoryCaptureStore();
  const metrics = deps.metrics ?? createMetrics();

  // Auth gate — must be registered BEFORE routes so the preHandler hook
  // fires for every authenticated route. /healthz, /readyz, /metrics are
  // skipped inside the hook.
  registerAuthHook(app, {
    ...(deps.testAuthInjector ? { testAuthInjector: deps.testAuthInjector } : {}),
  });

  app.get('/healthz', async () => ({ status: 'ok', service: 'field-capture-service' }));
  app.get('/readyz', async () => ({ status: 'ready', service: 'field-capture-service' }));

  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', metrics.registry.contentType);
    return metrics.registry.metrics();
  });

  await registerCaptureRoutes(app, {
    store,
    ...(deps.storageAdapter ? { storageAdapter: deps.storageAdapter } : {}),
    ...(deps.kindToBucket ? { kindToBucket: deps.kindToBucket } : {}),
  });

  return app;
}

async function main(): Promise<void> {
  // Build via the composition root so the standalone pod boots with a
  // real StorageAdapter (captures persist) or fails fast with an
  // actionable message when no durable backend is configured in
  // production. The bare `buildApp({})` would boot WITHOUT an adapter
  // and silently drop every inline-bytes capture. See
  // `composition/build-app.ts`.
  const { buildProductionApp } = await import('./composition/build-app.js');
  const app = await buildProductionApp();
  const port = Number(process.env.PORT ?? 9020);
  const host = process.env.HOST ?? '0.0.0.0';
  try {
    await app.listen({ port, host });
    logger.info(`[field-capture-service] listening on http://${host}:${port}`);
  } catch (err) {
    logger.error('[field-capture-service] fatal', { error: err });
    process.exit(1);
  }
}

// Auto-start when invoked directly (`node dist/index.js`). Uses
// `pathToFileURL` (not `new URL('file://' + argv)`) so dev paths with
// spaces still match — the raw constructor does not percent-encode
// spaces and main() would never fire. The `.catch` + process.exit
// ensures the production fail-fast throw in `buildProductionApp` exits
// cleanly (code 1) instead of surfacing as an UnhandledPromiseRejection.
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
    logger.error('[field-capture-service] unhandled fatal', { error: err });
    process.exit(1);
  });
}

// NOTE: the composition root (`composition/build-app.ts`) is intentionally
// NOT re-exported from this module. It is loaded only via the dynamic
// `await import()` inside `main()` (and directly by tests), mirroring
// `services/outcomes-metering` — keeping it out of the static export graph
// avoids the index ↔ build-app circular-import eager-evaluation hazard.
