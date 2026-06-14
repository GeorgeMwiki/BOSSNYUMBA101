/**
 * Regression: a kernel_cot_reservoir QUERY ERROR must never masquerade as
 * an empty queue.
 *
 * Before migration 0325, the consolidation adapter queried
 * `consolidated_at` / `user_id` columns that did not exist, so every live
 * hourly tick raised `column "consolidated_at" does not exist`. The
 * adapter caught that and returned `[]` — indistinguishable from "no
 * pending rows" — so CoT consolidation was a PERMANENT SILENT no-op.
 *
 * These tests lock the fixed contract:
 *   1. A query error RAISES a staff alert and REJECTS (it does NOT
 *      resolve to `[]`).
 *   2. A genuine empty result set resolves to `[]` and raises NO alert —
 *      the two cases stay distinct.
 *   3. End-to-end through the tick loop, the alert is raised and the tick
 *      records a `fetch:` error rather than silently processing zero rows.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  createReservoirSource,
  defaultAlertSink,
  type DrizzleLikeClient,
} from '../index.js';
import {
  runConsolidationTick,
  createStubConsolidator,
  type AlertSink,
  type ConsolidationDeps,
  type SemanticSink,
  type WorkerLogger,
} from '../consolidation.js';

function makeAlertSpy(): AlertSink & {
  readonly calls: ReadonlyArray<{ code: string; message: string }>;
} {
  const calls: { code: string; message: string }[] = [];
  return {
    calls,
    raise: ({ code, message }) => {
      calls.push({ code, message });
    },
  };
}

function throwingDb(message: string): DrizzleLikeClient {
  return {
    execute: () => Promise.reject(new Error(message)),
  };
}

function resultDb(rows: ReadonlyArray<Record<string, unknown>>): DrizzleLikeClient {
  return {
    execute: () => Promise.resolve({ rows }),
  };
}

const SINCE = new Date('2026-06-14T00:00:00.000Z');

describe('createReservoirSource — query error is not an empty queue', () => {
  it('RAISES a staff alert and REJECTS on a schema-drift query error (never returns [])', async () => {
    const alerts = makeAlertSpy();
    const source = createReservoirSource(
      throwingDb('column "consolidated_at" does not exist'),
      alerts,
    );

    await expect(
      source.fetchUnconsolidated({ since: SINCE, limit: 100 }),
    ).rejects.toThrow(/consolidated_at/);

    expect(alerts.calls).toHaveLength(1);
    expect(alerts.calls[0]?.code).toBe('consolidation.reservoir_fetch_failed');
    expect(alerts.calls[0]?.message).toContain('column "consolidated_at" does not exist');
  });

  it('does NOT swallow the error as [] — the rejection must propagate', async () => {
    const alerts = makeAlertSpy();
    const source = createReservoirSource(throwingDb('connection reset'), alerts);

    // The bug was: this resolved to []. The fix: it must REJECT.
    let resolvedValue: unknown = 'NOT_SET';
    let rejected = false;
    try {
      resolvedValue = await source.fetchUnconsolidated({ since: SINCE });
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
    expect(resolvedValue).toBe('NOT_SET');
    expect(alerts.calls).toHaveLength(1);
  });

  it('a real EMPTY result set resolves to [] and raises NO alert (distinct from error)', async () => {
    const alerts = makeAlertSpy();
    const source = createReservoirSource(resultDb([]), alerts);

    const entries = await source.fetchUnconsolidated({ since: SINCE });
    expect(entries).toEqual([]);
    expect(alerts.calls).toHaveLength(0);
  });

  it('a populated result set maps rows and raises NO alert', async () => {
    const alerts = makeAlertSpy();
    const source = createReservoirSource(
      resultDb([
        {
          thought_id: 't1',
          tenant_id: 'tenant-a',
          user_id: 'user-1',
          thread_id: 'thread-1',
          summary: 'asked about rent',
          captured_at: '2026-06-14T01:00:00.000Z',
        },
      ]),
      alerts,
    );

    const entries = await source.fetchUnconsolidated({ since: SINCE });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.thoughtId).toBe('t1');
    expect(entries[0]?.userId).toBe('user-1');
    expect(alerts.calls).toHaveLength(0);
  });

  it('skips rows missing thought_id / user_id without raising an alert', async () => {
    const alerts = makeAlertSpy();
    const source = createReservoirSource(
      resultDb([
        { thought_id: 't1', user_id: null, thread_id: 'x', summary: 's', captured_at: SINCE.toISOString() },
        { thought_id: null, user_id: 'u2', thread_id: 'x', summary: 's', captured_at: SINCE.toISOString() },
        { thought_id: 't3', user_id: 'u3', thread_id: 'x', summary: 's', captured_at: SINCE.toISOString() },
      ]),
      alerts,
    );

    const entries = await source.fetchUnconsolidated({ since: SINCE });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.thoughtId).toBe('t3');
    expect(alerts.calls).toHaveLength(0);
  });
});

describe('end-to-end tick — schema drift surfaces as a fetch error + alert', () => {
  it('raises the alert AND records a fetch error (never a silent zero-row no-op)', async () => {
    const alerts = makeAlertSpy();
    const source = createReservoirSource(
      throwingDb('column "user_id" does not exist'),
      alerts,
    );

    const upserts: unknown[] = [];
    const sink: SemanticSink = {
      async upsertFact(args) {
        upserts.push(args);
      },
    };
    const logCalls: { level: string }[] = [];
    const logger: WorkerLogger = {
      info: () => logCalls.push({ level: 'info' }),
      warn: () => logCalls.push({ level: 'warn' }),
      error: () => logCalls.push({ level: 'error' }),
    };

    const deps: ConsolidationDeps = {
      source,
      sink,
      consolidator: createStubConsolidator(),
      logger,
    };

    const result = await runConsolidationTick(deps);

    // The tick recorded the error rather than treating the queue as empty.
    expect(result.errors.some((e) => e.startsWith('fetch:'))).toBe(true);
    expect(result.entriesProcessed).toBe(0);
    // Nothing was written — and critically, the alert fired.
    expect(upserts).toHaveLength(0);
    expect(alerts.calls).toHaveLength(1);
    expect(alerts.calls[0]?.code).toBe('consolidation.reservoir_fetch_failed');
  });
});

describe('defaultAlertSink', () => {
  it('is callable and does not throw (Pino-error-line sink)', () => {
    const sink = defaultAlertSink();
    expect(() =>
      sink.raise({ code: 'x.y', message: 'boom', context: { a: 1 } }),
    ).not.toThrow();
  });
});
