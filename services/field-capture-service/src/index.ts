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

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import {
  createInMemoryCaptureStore,
  type CaptureStore,
} from '@bossnyumba/geo-intelligence';
import { registerCaptureRoutes } from './routes/captures.js';
import { createMetrics, type MetricsHarness } from './metrics.js';

export interface BuildAppDeps {
  readonly store?: CaptureStore;
  readonly metrics?: MetricsHarness;
}

export async function buildApp(deps: BuildAppDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const store = deps.store ?? createInMemoryCaptureStore();
  const metrics = deps.metrics ?? createMetrics();

  app.get('/healthz', async () => ({ status: 'ok', service: 'field-capture-service' }));
  app.get('/readyz', async () => ({ status: 'ready', service: 'field-capture-service' }));

  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', metrics.registry.contentType);
    return metrics.registry.metrics();
  });

  await registerCaptureRoutes(app, { store });

  return app;
}

async function main(): Promise<void> {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 9020);
  const host = process.env.HOST ?? '0.0.0.0';
  try {
    await app.listen({ port, host });
    // eslint-disable-next-line no-console
    console.log(`[field-capture-service] listening on http://${host}:${port}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[field-capture-service] fatal:', err);
    process.exit(1);
  }
}

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
