/**
 * GET /readyz — Kubernetes readiness probe.
 *
 * `/healthz` is liveness (process up). `/readyz` is readiness — only
 * 200 once we can actually serve traffic. In production that means
 * the Postgres pool can answer a trivial `SELECT 1`. When no pool is
 * wired (memory-mode dev/test), `/readyz` returns 200 immediately:
 * the in-memory store has no async startup, so the process is ready
 * the moment Fastify has bound the port.
 *
 * BORN-DARK GUARD (finding BORN-DARK + FAKE-PERSISTENCE): the in-memory
 * billing store is VOLATILE and PER-REPLICA — billing rows vanish on
 * restart and never aggregate cluster-wide. A production deploy running
 * in memory mode is a silent revenue-loss state. So when prod adapters
 * are REQUIRED (`OUTCOMES_METERING_PROD_ADAPTERS=1` or
 * `NODE_ENV=production`) and no DB pool is wired, `/readyz` FAILS 503 —
 * the born-dark state can never pass as healthy. This mirrors the
 * `SLEEP_PASS_PROD_ADAPTERS` fail-fast guard in the sibling workers.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';

/**
 * Minimal pool-like interface — we only need to issue a single ping.
 * Both `pg.Pool` and `@bossnyumba/database` connection wrappers expose
 * a `query` method matching this signature.
 */
export interface ReadinessDbPool {
  query(sql: string): Promise<unknown>;
}

export interface RegisterReadyzRoutesDeps {
  /** Optional DB pool; when present, /readyz issues `SELECT 1`. */
  readonly dbPool?: ReadinessDbPool;
  /** Per-probe timeout in ms; default 2_000. */
  readonly probeTimeoutMs?: number;
  /**
   * Whether REAL production adapters are required. When `true` and no
   * `dbPool` is wired, `/readyz` returns 503 (born-dark guard) instead
   * of a false-healthy 200. Defaults to the env read
   * ({@link prodAdaptersRequired}).
   */
  readonly requireProdAdapters?: boolean;
}

/**
 * Whether the service must run with REAL production adapters. True when
 * `OUTCOMES_METERING_PROD_ADAPTERS=1` is explicitly set, or when
 * `NODE_ENV=production`. Mirrors the `SLEEP_PASS_PROD_ADAPTERS` guard
 * semantics used by the sibling sleep-time workers.
 */
export function prodAdaptersRequired(): boolean {
  if (process.env['OUTCOMES_METERING_PROD_ADAPTERS'] === '1') return true;
  return process.env['NODE_ENV'] === 'production';
}

export async function registerReadyzRoutes(
  app: FastifyInstance,
  deps: RegisterReadyzRoutesDeps = {},
): Promise<void> {
  const probeTimeoutMs = deps.probeTimeoutMs ?? 2_000;
  const mustHaveProd = deps.requireProdAdapters ?? prodAdaptersRequired();

  app.get('/readyz', async (_request, reply: FastifyReply) => {
    // Memory mode — no DB to ping.
    if (!deps.dbPool) {
      // BORN-DARK GUARD: a prod deploy in memory mode is a silent
      // revenue-loss state (volatile, per-replica store). Refuse to
      // report healthy so K8s never routes traffic to it.
      if (mustHaveProd) {
        return reply.code(503).send({
          ready: false,
          service: 'outcomes-metering',
          mode: 'memory',
          reason:
            'production adapters required (OUTCOMES_METERING_PROD_ADAPTERS=1 or NODE_ENV=production) ' +
            'but the in-memory store is wired — refusing to serve a volatile, per-replica billing store',
        });
      }
      // Dev/test — the in-memory store is synchronous, so the moment
      // Fastify has accepted the connection we're ready.
      return reply.code(200).send({
        ready: true,
        service: 'outcomes-metering',
        mode: 'memory',
      });
    }

    // Race the SELECT 1 against a timeout so a wedged DB connection
    // doesn't pin the readiness probe (K8s would otherwise wait the
    // full HTTP timeout, ~30s).
    try {
      await Promise.race([
        deps.dbPool.query('SELECT 1'),
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error('db ping timeout')), probeTimeoutMs),
        ),
      ]);
      return reply.code(200).send({
        ready: true,
        service: 'outcomes-metering',
        mode: 'db',
      });
    } catch (err) {
      return reply.code(503).send({
        ready: false,
        service: 'outcomes-metering',
        mode: 'db',
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
