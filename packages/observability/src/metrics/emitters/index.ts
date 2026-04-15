/**
 * Metric emitter barrel.
 *
 * Call sites should import from here (or from the package root) rather than
 * reaching into individual files. Until a metrics backend is configured each
 * emitter no-ops through the log-based sink in `log-sink.ts`.
 */
export type { MetricRecord, MetricSink } from './log-sink.js';
export { emitMetric, setMetricSink, resetMetricSink } from './log-sink.js';

export type { HttpRequestMetric } from './http.js';
export { emitHttpRequest } from './http.js';

export type { LlmCallMetric } from './llm.js';
export { emitLlmCall } from './llm.js';

export type {
  MpesaTransactionMetric,
  MpesaTxType,
  MpesaTxStatus,
} from './mpesa.js';
export { emitMpesaTransaction } from './mpesa.js';

export type { DbQueryMetric, DbOperation } from './db.js';
export { emitDbQuery } from './db.js';
