/**
 * Prometheus metrics wiring for the onboarding-orchestrator service.
 *
 * Exposes:
 *   - Default Node metrics (event loop lag, GC, RSS) via
 *     `prom-client`'s `collectDefaultMetrics`.
 *   - `http_request_duration_seconds` histogram labelled by method,
 *     route, status.
 *   - `http_requests_total` counter labelled the same.
 *
 * Registers `GET /metrics` on the Fastify instance — same port as the
 * app to match the ServiceMonitor at
 * `infra/k8s/onboarding-orchestrator/base/servicemonitor.yaml`.
 */

import client from 'prom-client';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const SERVICE_NAME = 'onboarding-orchestrator';

export interface MetricsHandle {
  readonly registry: client.Registry;
}

export function registerMetrics(app: FastifyInstance): MetricsHandle {
  const registry = new client.Registry();
  registry.setDefaultLabels({ service: SERVICE_NAME });
  client.collectDefaultMetrics({ register: registry });

  const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    // Onboarding turns are conversational — most requests fall under
    // 1s, but the multi-model extraction path can hit several seconds
    // on heavy LLM calls.
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const httpRequests = new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests by method, route and status',
    labelNames: ['method', 'route', 'status'],
    registers: [registry],
  });

  app.addHook('onRequest', async (request) => {
    (request as unknown as { __metricsStartNs: bigint }).__metricsStartNs =
      process.hrtime.bigint();
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const startNs = (request as unknown as { __metricsStartNs?: bigint })
      .__metricsStartNs;
    if (startNs === undefined) return;
    const durationSeconds = Number(process.hrtime.bigint() - startNs) / 1e9;

    const route =
      (request.routeOptions as { url?: string } | undefined)?.url ??
      (request.url.split('?')[0] || 'unmatched');
    const labels = {
      method: request.method,
      route,
      status: String(reply.statusCode),
    };
    httpDuration.observe(labels, durationSeconds);
    httpRequests.inc(labels);
  });

  app.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', registry.contentType);
    return registry.metrics();
  });

  return { registry };
}
