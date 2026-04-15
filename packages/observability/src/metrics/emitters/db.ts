/**
 * Database query metric emitter.
 */
import { emitMetric } from './log-sink.js';

export type DbOperation =
  | 'select'
  | 'insert'
  | 'update'
  | 'delete'
  | 'upsert'
  | 'raw'
  | string;

export interface DbQueryMetric {
  table: string;
  operation: DbOperation;
  latencyMs: number;
  tenantId?: string;
  /** Number of rows affected / returned, if known. */
  rowCount?: number;
  /** "ok" | "error" */
  outcome?: 'ok' | 'error' | string;
}

export function emitDbQuery(metric: DbQueryMetric): void {
  emitMetric('db.query', metric.latencyMs, {
    table: metric.table,
    operation: metric.operation,
    tenantId: metric.tenantId,
    rowCount: metric.rowCount,
    outcome: metric.outcome,
  });
}
