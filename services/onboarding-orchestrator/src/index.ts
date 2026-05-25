/**
 * @bossnyumba/onboarding-orchestrator — Fastify HTTP entrypoint +
 * barrel exports for the composition root.
 *
 * Wires:
 *   - GET  /healthz  — liveness (process is up)
 *   - GET  /readyz   — readiness (DB ping when wired, else memory mode)
 *   - GET  /metrics  — Prometheus exposition (same port as the app)
 *
 * The full conversational + bootstrap surface (sessions, turn
 * handling, idempotent writer, rollback) is exposed through the
 * barrel exports below; the composition root wires those into the
 * api-gateway, this service hosts the standalone HTTP listener +
 * the K8s-required health/readyz/metrics endpoints.
 *
 * Env vars consumed:
 *   - `PORT`         — Fastify listen port (default 3014; matches the
 *                      K8s manifest at infra/k8s/onboarding-orchestrator)
 *   - `HOST`         — Fastify listen host (default 0.0.0.0)
 *   - `NODE_ENV`     — production / staging / dev
 */

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import {
  registerReadyzRoutes,
  type ReadinessDbPool,
} from './routes/readyz.js';
import { registerMetrics } from './observability/metrics.js';
import { logger } from './logger.js';

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

export interface BuildAppDeps {
  /**
   * Optional DB pool used by `/readyz`. When omitted, the readiness
   * probe returns 200 in "memory mode" — the in-memory SessionStore
   * has no async dependency to wait on.
   */
  readonly dbPool?: ReadinessDbPool;
}

export interface BuildAppResult {
  readonly app: FastifyInstance;
}

/**
 * Build a Fastify instance with the K8s-required probe + metrics
 * endpoints wired. The full conversational orchestrator surface is
 * intentionally not mounted here yet — the api-gateway composition
 * root hosts the turn handling routes against the same factories
 * exported below. See `.audit/litfin-sota-2026-05-23/20-zero-friction-onboarding.md`
 * §12 for the canonical wiring plan.
 */
export async function buildApp(deps: BuildAppDeps = {}): Promise<BuildAppResult> {
  const app = Fastify({ logger: false });

  // Metrics middleware first — must register hooks before any routes
  // are mounted so it observes everything below.
  registerMetrics(app);

  app.get('/healthz', async () => ({
    status: 'ok',
    service: 'onboarding-orchestrator',
  }));

  await registerReadyzRoutes(app, {
    ...(deps.dbPool ? { dbPool: deps.dbPool } : {}),
  });

  return { app };
}

async function main(): Promise<void> {
  const { app } = await buildApp();
  const port = Number(process.env.PORT ?? 3014);
  const host = process.env.HOST ?? '0.0.0.0';
  try {
    await app.listen({ port, host });
    logger.info(`[onboarding-orchestrator] listening on http://${host}:${port}`);
  } catch (err) {
    logger.error('[onboarding-orchestrator] fatal', { error: err });
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
// Public barrel — re-exports for the api-gateway composition root.
// ---------------------------------------------------------------------------

export {
  type ReadinessDbPool,
  type RegisterReadyzRoutesDeps,
} from './routes/readyz.js';
