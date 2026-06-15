/**
 * Cron handler — runs the nightly brain-evolution sweep.
 *
 * Designed to be invoked TWO ways:
 *
 *   1. In-process via a node-cron schedule (every 24h, 02:00 tenant-
 *      local time approximated as 02:00 UTC at this layer; per-tenant
 *      timezone-aware scheduling is a later enhancement).
 *
 *   2. By an external scheduler (Kubernetes CronJob) which fires the
 *      service entrypoint at 02:00 UTC daily. The entrypoint sets
 *      `BRAIN_EVOLUTION_INTERVAL_MS=0` so this handler runs once + exits.
 *
 * Both paths reuse `runNightlySweep` — the cron loop just calls it on a
 * schedule. The Kubernetes CronJob short-circuits the loop and calls
 * `runNightlySweep` once.
 */

import { randomBytes } from 'crypto';

import { withWorkerTenantContext } from '@bossnyumba/database';

import { iterateTenants, type TenantIterationSummary } from './tenant-iteration.js';
import { readDailyTraces, type TraceReader } from '../pipeline/stage-01-read-traces.js';
import { reflectOnDay, type ReflectionEngine } from '../pipeline/stage-02-reflect.js';
import { extractDeltas, type DeltaExtractor } from '../pipeline/stage-03-extract-deltas.js';
import { writeApprovedDeltas, type MemoryWriter } from '../pipeline/stage-04-write-memory.js';
import { emitEvolutionReport, type ReportSink } from '../pipeline/stage-05-emit-report.js';
import { generateAutobiographyDeltas } from '../pipeline/stage-06-autobiography.js';
import { reviewDelta, type ConstitutionVerifierPort } from '../safety/review-gate.js';
import type { DrizzleLikeClient } from '../composition/shared.js';
import type {
  BrainWorkerLogger,
  TenantRunResult,
  DeltaApplicationResult,
} from '../types.js';

export interface TenantDirectory {
  /** List every active tenant the sweep should process. */
  listActiveTenants(): Promise<ReadonlyArray<string>>;
  /** Jurisdiction ISO-3166-1 alpha-2 for a tenant. Used by the verifier. */
  jurisdictionFor(tenantId: string): string;
}

export interface NightlySweepDeps {
  /**
   * The raw Drizzle handle the trace-reader + memory-writer adapters close
   * over. `runForTenant` binds the per-tenant RLS GUC on THIS same handle
   * (via `withWorkerTenantContext`) so the episodic read and the
   * `kernel_memory_*` writes share one tenant-scoped transaction — without
   * it the non-BYPASS prod role reads zero rows and writes are RLS-rejected.
   */
  readonly db: DrizzleLikeClient;
  readonly directory: TenantDirectory;
  readonly traceReader: TraceReader;
  readonly reflectionEngine: ReflectionEngine;
  readonly memoryWriter: MemoryWriter;
  readonly reportSink: ReportSink;
  readonly verifier: ConstitutionVerifierPort;
  readonly extractor?: DeltaExtractor;
  /**
   * Re-bind the DB-backed ports (trace-reader / memory-writer / report-sink)
   * onto the connection-pinned handle that `withWorkerTenantContext` reserves
   * per tenant. Supplied by the composition root. Required so the episodic
   * read + memory writes run on the SAME reserved connection the per-tenant
   * `SET LOCAL` bound — without it the body would hit the pooled `db` and the
   * GUC could miss. Absent in test fakes (single-connection), where the
   * passed-through ports already share the one connection.
   */
  readonly rebindPorts?: (pinned: DrizzleLikeClient) => {
    readonly traceReader: TraceReader;
    readonly memoryWriter: MemoryWriter;
    readonly reportSink: ReportSink;
  };
  readonly logger?: BrainWorkerLogger;
  /** Override for tests; defaults to `new Date()`. */
  readonly clock?: { now(): Date };
  readonly windowMs?: number;
  readonly concurrency?: number;
}

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The whole nightly sweep — list tenants, iterate with bounded
 * concurrency, return summary. Never throws.
 */
export async function runNightlySweep(
  deps: NightlySweepDeps,
): Promise<TenantIterationSummary> {
  const tenantIds = await safeListTenants(deps);
  if (tenantIds.length === 0) {
    deps.logger?.info?.({}, 'brain-evolution-worker: no tenants — sweep is a no-op');
    return {
      totalTenants: 0,
      ok: 0,
      skipped: 0,
      errored: 0,
      totalDeltasApplied: 0,
      totalDeltasEscalated: 0,
      totalDeltasBlocked: 0,
      results: [],
    };
  }

  return iterateTenants({
    tenantIds,
    concurrency: deps.concurrency,
    logger: deps.logger,
    runForTenant: (tenantId) => runForTenant(deps, tenantId),
  });
}

/**
 * Pipeline for a single tenant. Each stage runs through its dedicated
 * port; failures degrade gracefully — the run produces a report even
 * when an upstream stage produced zero data.
 */
async function runForTenant(
  deps: NightlySweepDeps,
  tenantId: string,
): Promise<TenantRunResult> {
  // Bind the per-tenant RLS GUC on the SAME raw handle the trace-reader +
  // memory-writer adapters close over, so the `kernel_memory_episodic` read
  // and the `kernel_memory_*` writes for THIS tenant run inside one
  // tenant-scoped transaction. Without it the non-BYPASS prod role sees zero
  // episodic rows and every write is RLS-rejected — the whole sweep is a
  // silent no-op. `withWorkerTenantContext` re-throws on failure, which the
  // `iterateTenants` per-tenant catch already folds into an `error` result.
  return withWorkerTenantContext(deps.db, tenantId, async (pinned) => {
  // Re-bind the DB-backed ports onto the pinned (reserved) connection so the
  // episodic read and the kernel_memory_* writes for THIS tenant run on the
  // connection the SET LOCAL bound. Falls back to the passed-through ports
  // when no rebinder is supplied (test fakes — already single-connection).
  const bound = deps.rebindPorts?.(pinned as DrizzleLikeClient);
  const traceReader = bound?.traceReader ?? deps.traceReader;
  const memoryWriter = bound?.memoryWriter ?? deps.memoryWriter;
  const reportSink = bound?.reportSink ?? deps.reportSink;
  const now = (deps.clock ?? { now: () => new Date() }).now();
  const windowMs = deps.windowMs ?? DEFAULT_WINDOW_MS;
  const windowEnd = now;
  const windowStart = new Date(now.getTime() - windowMs);
  const runId = `brevo_${windowEnd.getTime()}_${randomBytes(4).toString('hex')}`;

  const traceResult = await readDailyTraces(traceReader, {
    tenantId,
    windowStart,
    windowEnd,
    logger: deps.logger,
  });

  if (traceResult.traces.length === 0) {
    deps.logger?.info?.(
      { tenantId, runId },
      'brain-evolution-worker: no traces — skipping reflection',
    );
    return {
      tenantId,
      status: 'skipped',
      tracesRead: 0,
      deltasApplied: 0,
      deltasEscalated: 0,
      deltasBlocked: 0,
      errorMessage: null,
      report: null,
    };
  }

  const reflection = await reflectOnDay(deps.reflectionEngine, {
    tenantId,
    windowStart: traceResult.windowStart,
    windowEnd: traceResult.windowEnd,
    traces: traceResult.traces,
    logger: deps.logger,
  });

  const reflectionDeltas = extractDeltas({
    reflection,
    extractor: deps.extractor,
  });

  // Stage 06 — autobiography deltas. Mixed into the same review-gate +
  // write path as reflection-derived deltas so the constitution gets
  // first say on every narrative the brain commits to its persona block.
  const autobiographyDeltas = generateAutobiographyDeltas({
    tenantId,
    windowStart: traceResult.windowStart,
    windowEnd: traceResult.windowEnd,
    traces: traceResult.traces,
    ...(deps.logger ? { logger: deps.logger } : {}),
  });

  const deltas = [...reflectionDeltas, ...autobiographyDeltas];

  // Run each delta through the review gate IN SERIES — the verifier is
  // sync so parallelism would just rack up event-loop microtasks.
  const approvals: DeltaApplicationResult[] = deltas.map((delta) =>
    reviewDelta(
      {
        verifier: deps.verifier,
        jurisdictionFor: (id) => deps.directory.jurisdictionFor(id),
        logger: deps.logger,
      },
      delta,
    ),
  );

  const writeResults = await writeApprovedDeltas(memoryWriter, {
    deltas,
    approvals,
    logger: deps.logger,
  });

  const report = await emitEvolutionReport(reportSink, {
    tenantId,
    runId,
    reflection,
    deltas,
    results: writeResults,
    tracesRead: traceResult.traces.length,
    emittedAt: windowEnd,
    logger: deps.logger,
  });

  const applied = writeResults.filter((r) => r.applied).length;
  const escalated = writeResults.filter((r) => !r.applied && r.escalated).length;
  const blocked = writeResults.filter((r) => !r.applied && !r.escalated).length;

  return {
    tenantId,
    status: 'ok',
    tracesRead: traceResult.traces.length,
    deltasApplied: applied,
    deltasEscalated: escalated,
    deltasBlocked: blocked,
    errorMessage: null,
    report,
  };
  });
}

async function safeListTenants(
  deps: NightlySweepDeps,
): Promise<ReadonlyArray<string>> {
  try {
    return await deps.directory.listActiveTenants();
  } catch (error) {
    deps.logger?.warn?.(
      { err: error instanceof Error ? error.message : String(error) },
      'brain-evolution-worker: tenant directory failed — sweep aborted',
    );
    return [];
  }
}
