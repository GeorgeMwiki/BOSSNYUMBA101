/**
 * GET /readyz — Kubernetes readiness probe.
 *
 * `/healthz` is liveness (process up). `/readyz` is readiness — only
 * 200 when the service can answer real onboarding traffic. The
 * orchestrator currently runs in two modes:
 *
 *   - **memory mode** (dev/test): the in-memory SessionStore is
 *     synchronous; we're ready as soon as Fastify has bound the port.
 *   - **db mode** (staging/prod): the drizzle-backed SessionStore
 *     requires a working Postgres pool. We issue a `SELECT 1` to
 *     confirm we can serve real sessions.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';

export interface ReadinessDbPool {
  query(sql: string): Promise<unknown>;
}

export interface RegisterReadyzRoutesDeps {
  /** Optional DB pool; when present, /readyz issues `SELECT 1`. */
  readonly dbPool?: ReadinessDbPool;
  /** Per-probe timeout in ms; default 2_000. */
  readonly probeTimeoutMs?: number;
}

export async function registerReadyzRoutes(
  app: FastifyInstance,
  deps: RegisterReadyzRoutesDeps = {},
): Promise<void> {
  const probeTimeoutMs = deps.probeTimeoutMs ?? 2_000;

  app.get('/readyz', async (_request, reply: FastifyReply) => {
    if (!deps.dbPool) {
      return reply.code(200).send({
        ready: true,
        service: 'onboarding-orchestrator',
        mode: 'memory',
      });
    }

    try {
      await Promise.race([
        deps.dbPool.query('SELECT 1'),
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error('db ping timeout')), probeTimeoutMs),
        ),
      ]);
      return reply.code(200).send({
        ready: true,
        service: 'onboarding-orchestrator',
        mode: 'db',
      });
    } catch (err) {
      return reply.code(503).send({
        ready: false,
        service: 'onboarding-orchestrator',
        mode: 'db',
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
