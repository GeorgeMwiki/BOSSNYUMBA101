/**
 * HTTP request metric emitter.
 */
import { emitMetric } from './log-sink.js';

export interface HttpRequestMetric {
  method: string;
  path: string;
  status: number;
  latencyMs: number;
  tenantId?: string;
}

export function emitHttpRequest(metric: HttpRequestMetric): void {
  emitMetric('http.request', metric.latencyMs, {
    method: metric.method,
    path: metric.path,
    status: metric.status,
    tenantId: metric.tenantId,
  });
}
