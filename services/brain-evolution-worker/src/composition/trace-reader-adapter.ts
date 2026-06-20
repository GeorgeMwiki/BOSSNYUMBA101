/**
 * Trace reader adapter — pulls the day's interaction traces for a tenant
 * from `kernel_memory_episodic`.
 *
 * The worker's `InteractionTrace` contract is uniform across trace
 * sources; this adapter maps episodic rows into it:
 *   - `traceId`     ← episodic row id
 *   - `kind`        ← episodic enum ('user-message'|'agent-action'|'tool-result')
 *   - `outcome`     ← derived from `payload.outcome` (episodic has no
 *                     dedicated outcome column); null when absent.
 *   - `personaId`   ← `payload.personaId` when the row carries one.
 *
 * Rows are read oldest-first within `[windowStart, windowEnd)` so the
 * reflection stage sees the day chronologically (stage-01 expects this).
 *
 * Pure raw-SQL adapter — failures bubble as a thrown error which stage-01
 * (`readDailyTraces`) catches and degrades to an empty trace set, so a
 * pre-migration / missing-table environment is a benign per-tenant no-op
 * rather than a crash.
 */

import { sql } from 'drizzle-orm';

import type { TraceReader } from '../pipeline/stage-01-read-traces.js';
import type { InteractionTrace } from '../types.js';
import {
  asString,
  asNullableString,
  asDateString,
  asRecord,
  clampLimit,
  toRows,
  type DrizzleLikeClient,
} from './shared.js';

export interface TraceReaderAdapterDeps {
  readonly db: DrizzleLikeClient;
}

/**
 * Build a trace reader over `kernel_memory_episodic`. Returns at most
 * `limit` rows ordered oldest-first inside the half-open window.
 */
export function createTraceReaderAdapter(
  deps: TraceReaderAdapterDeps,
): TraceReader {
  return {
    async readTraces(args) {
      const lim = clampLimit(args.limit, 5_001);
      const result = (await deps.db.execute(
        sql`SELECT id, tenant_id, user_id, thread_id, turn_id,
                   kind, summary, payload, captured_at
            FROM kernel_memory_episodic
            WHERE tenant_id = ${args.tenantId}
              AND captured_at >= ${args.windowStart.toISOString()}
              AND captured_at < ${args.windowEnd.toISOString()}
            ORDER BY captured_at ASC
            LIMIT ${lim}`,
      )) as unknown;

      const rows = toRows(result) as ReadonlyArray<{
        id?: unknown;
        tenant_id?: unknown;
        user_id?: unknown;
        thread_id?: unknown;
        kind?: unknown;
        summary?: unknown;
        payload?: unknown;
        captured_at?: unknown;
      }>;

      const traces: InteractionTrace[] = [];
      for (const row of rows) {
        const traceId = asString(row.id);
        if (!traceId) continue;
        const payload = asRecord(row.payload);
        traces.push({
          traceId,
          tenantId: asString(row.tenant_id) ?? args.tenantId,
          userId: asNullableString(row.user_id),
          personaId: asNullableString(payload['personaId']),
          threadId: asNullableString(row.thread_id),
          capturedAt: asDateString(row.captured_at),
          kind: asString(row.kind) ?? 'agent-action',
          summary: asString(row.summary) ?? '',
          payload,
          outcome: deriveOutcome(payload),
        });
      }
      return traces;
    },
  };
}

function deriveOutcome(
  payload: Readonly<Record<string, unknown>>,
): string | null {
  const raw = payload['outcome'];
  if (
    raw === 'success' ||
    raw === 'failure' ||
    raw === 'corrected' ||
    raw === 'abandoned'
  ) {
    return raw;
  }
  return null;
}
