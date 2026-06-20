/**
 * Entrypoint live-detector test.
 *
 * Asserts the composition root (`src/index.ts`) builds a RUNNABLE nightly
 * sweep — the exact thing BLOCKER #3 was about: the Dockerfile CMD
 * `node dist/index.js` had no module to run, so the CronJob crash-looped.
 *
 * These tests run the real adapters against a fake `DrizzleLikeClient`
 * (no Postgres) so they prove the wiring is reachable end-to-end:
 *   - `buildRunnableSweep` wires every port and returns a callable `run`.
 *   - `runOnce` drives a real sweep over a tenant + its episodic traces
 *     and returns a non-throwing summary with the expected tenant count.
 *   - `main({ db: null })` is a clean no-op in DEV (degraded env never crashes).
 *   - `main({ db: null, requireProdAdapters: true })` FAIL-FASTS (throws) so
 *     a degraded no-op cannot pass as a healthy nightly run in production.
 */

import { describe, it, expect, vi } from 'vitest';

import {
  buildRunnableSweep,
  runOnce,
  main,
} from '../index.js';
import type { DrizzleLikeClient } from '../composition/shared.js';
import type { BrainWorkerLogger } from '../types.js';

// ── A silent logger so the test output stays clean. ──────────────────
const silentLogger: BrainWorkerLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/**
 * Fake Drizzle client. The raw adapters issue `db.execute(sql\`…\`)`. We
 * can't introspect the compiled SQL portably, so we route by query order:
 * the directory query (tenants) fires first, then per-tenant trace reads.
 * A query carrying a `tenant_id =` fragment is a trace read; everything
 * else is the tenant list. We sniff the serialised SQL for those tokens.
 */
function createFakeDb(rowsBySqlToken: {
  tenants: ReadonlyArray<Record<string, unknown>>;
  traces: ReadonlyArray<Record<string, unknown>>;
}): { db: DrizzleLikeClient; calls: string[] } {
  const calls: string[] = [];
  const db: DrizzleLikeClient = {
    async execute(q: unknown) {
      const text = serialise(q);
      calls.push(text);
      if (/kernel_memory_episodic/i.test(text)) {
        return { rows: rowsBySqlToken.traces };
      }
      if (/FROM\s+tenants/i.test(text)) {
        return { rows: rowsBySqlToken.tenants };
      }
      // Writer / report-sink services issue their own drizzle calls; the
      // fake just returns an empty result so they no-op cleanly.
      return { rows: [] };
    },
  };
  return { db, calls };
}

function serialise(q: unknown): string {
  // drizzle `sql` template objects expose `.queryChunks` / `.sql`; fall
  // back to JSON for anything else. We only need the table tokens.
  try {
    const anyq = q as { queryChunks?: unknown[]; sql?: string };
    if (typeof anyq.sql === 'string') return anyq.sql;
    if (Array.isArray(anyq.queryChunks)) {
      return anyq.queryChunks
        .map((c) => {
          const value = (c as { value?: unknown[] })?.value;
          return Array.isArray(value) ? value.join(' ') : String((c as { value?: unknown })?.value ?? '');
        })
        .join(' ');
    }
    return JSON.stringify(q);
  } catch {
    return String(q);
  }
}

describe('brain-evolution-worker entrypoint', () => {
  it('buildRunnableSweep wires every port and returns a callable run()', () => {
    const { db } = createFakeDb({ tenants: [], traces: [] });
    const { deps, run } = buildRunnableSweep({ db, logger: silentLogger });

    // All six real ports must be present — proves the composition root
    // wired the full bundle, not a partial stub.
    expect(deps.directory).toBeDefined();
    expect(deps.traceReader).toBeDefined();
    expect(deps.reflectionEngine).toBeDefined();
    expect(deps.memoryWriter).toBeDefined();
    expect(deps.reportSink).toBeDefined();
    expect(deps.verifier).toBeDefined();
    expect(typeof run).toBe('function');
  });

  it('runOnce drives a real sweep over a tenant + its traces (no DB)', async () => {
    const { db, calls } = createFakeDb({
      tenants: [{ id: 'tenant-a', country: 'TZ' }],
      traces: [
        {
          id: 'ep-1',
          tenant_id: 'tenant-a',
          user_id: 'u-1',
          thread_id: 'th-1',
          turn_id: 'turn-1',
          kind: 'agent-action',
          summary: 'looked up lease balance',
          payload: { topic: 'lease-balance', outcome: 'success', personaId: 'mr-mwikila' },
          captured_at: new Date('2026-06-13T12:00:00.000Z'),
        },
      ],
    });

    const summary = await runOnce({ db, logger: silentLogger });

    // One active tenant processed, no throw, and the directory + trace
    // queries both fired — the sweep is genuinely reachable end-to-end.
    expect(summary.totalTenants).toBe(1);
    expect(summary.ok + summary.skipped + summary.errored).toBe(1);
    expect(summary.errored).toBe(0);
    expect(calls.some((c) => /FROM\s+tenants/i.test(c))).toBe(true);
    expect(calls.some((c) => /kernel_memory_episodic/i.test(c))).toBe(true);
  });

  it('main() with a null db is a clean no-op in DEV (degraded env never crashes)', async () => {
    // No DATABASE_URL injected, db explicitly null, prod adapters NOT
    // required → supervisor returns without throwing and without booting
    // an interval. `requireProdAdapters: false` pins the dev path so the
    // assertion holds regardless of the ambient NODE_ENV.
    await expect(
      main({
        db: null,
        logger: silentLogger,
        intervalMs: 0,
        requireProdAdapters: false,
      }),
    ).resolves.toBeUndefined();
  });

  it('main() FAIL-FASTS when prod adapters are required but db is null', async () => {
    // Mirrors the SLEEP_PASS_PROD_ADAPTERS guard: under NODE_ENV=production
    // (modelled here via requireProdAdapters), a missing db must THROW so
    // the CronJob job fails visibly instead of exiting 0 as a degraded
    // no-op with brain self-improvement silently absent.
    await expect(
      main({
        db: null,
        logger: silentLogger,
        intervalMs: 0,
        requireProdAdapters: true,
      }),
    ).rejects.toThrow(/production adapters are required/i);
  });

  it('main() in run-once mode resolves (does not hang on an interval)', async () => {
    const { db } = createFakeDb({ tenants: [], traces: [] });
    // intervalMs=0 → run-once; the promise must resolve, proving the
    // CronJob path exits instead of looping forever.
    const spy = vi.fn();
    await main({ db, logger: { ...silentLogger, info: spy }, intervalMs: 0 });
    expect(spy).toHaveBeenCalled();
  });
});
