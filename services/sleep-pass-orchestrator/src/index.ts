/**
 * `@bossnyumba/sleep-pass-orchestrator` — public surface + Fastify entrypoint.
 *
 * Always-on heartbeat orchestrator + 8 universally-applicable sleep passes
 * ported from LITFIN PROJECT/src/core/heartbeat. Production wires real
 * adapters at the composition root; in-memory adapters under
 * `./passes/adapters` power tests + local development.
 *
 * Exposes (when the standalone process is invoked directly):
 *   - GET /healthz  — liveness (process is up)
 *   - GET /readyz   — readiness (memory mode today; DB ping wired by
 *                     the composition root when adapters land)
 *   - GET /metrics  — Prometheus exposition on the app port (3040)
 *
 * Env vars consumed at standalone entry:
 *   - `PORT`                   — Fastify listen port (default 3040;
 *                                matches the K8s manifest at
 *                                infra/k8s/sleep-pass-orchestrator)
 *   - `HOST`                   — Fastify listen host (default 0.0.0.0)
 *   - `HEARTBEAT_INTERVAL_MS`  — pass dispatch cadence (default 60_000)
 */

export * from './types.js';
export {
  createOrchestrator,
  nextDueFrom,
  type Orchestrator,
} from './orchestrator.js';
export * from './passes/index.js';

// ---------------------------------------------------------------------------
// Standalone Fastify entrypoint — only runs when invoked directly.
// ---------------------------------------------------------------------------

import Fastify, { type FastifyInstance } from 'fastify';
import client from 'prom-client';

interface BuildAppResult {
  readonly app: FastifyInstance;
  readonly registry: client.Registry;
}

/**
 * Build a Fastify instance with the K8s-required probe + metrics
 * endpoints wired. The actual orchestrator loop is started separately
 * by `main` so the app handle can be reused in tests without booting
 * the timer.
 */
async function buildApp(): Promise<BuildAppResult> {
  const app = Fastify({ logger: false });

  const registry = new client.Registry();
  registry.setDefaultLabels({ service: 'sleep-pass-orchestrator' });
  client.collectDefaultMetrics({ register: registry });

  app.get('/healthz', async () => ({
    status: 'ok',
    service: 'sleep-pass-orchestrator',
  }));

  app.get('/readyz', async () => ({
    ready: true,
    service: 'sleep-pass-orchestrator',
    mode: 'memory',
  }));

  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', registry.contentType);
    return registry.metrics();
  });

  return { app, registry };
}

async function main(): Promise<void> {
  const { app } = await buildApp();
  const port = Number(process.env.PORT ?? 3040);
  const host = process.env.HOST ?? '0.0.0.0';
  try {
    await app.listen({ port, host });
    // eslint-disable-next-line no-console
    console.log(
      `[sleep-pass-orchestrator] listening on http://${host}:${port}`,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[sleep-pass-orchestrator] fatal:', err);
    process.exit(1);
  }

  // Note: the actual orchestrator loop (createOrchestrator + start()) is
  // wired by the api-gateway composition root, which has the Drizzle +
  // Redis adapters in scope. This standalone process exists primarily
  // for the always-on health/readyz/metrics endpoints and a future
  // self-contained adapter set; the loop is intentionally not started
  // here until those adapters land. The pod stays Ready and reports
  // metrics; consumers wire their own orchestrator via the barrel
  // exports above.
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
