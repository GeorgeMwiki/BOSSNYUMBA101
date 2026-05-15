/**
 * Decision-trace recorder — step 1b + 13f of the kernel pipeline.
 *
 * Records the per-thought breadcrumb of every kernel step the request
 * passed through (step name, duration_ms, decision/result summary,
 * errors). Distinct from the CoT reservoir (which is sampled) and the
 * provenance record (which is a single-row summary) — the trace is
 * always-on per-thought and captures the ordered step list.
 *
 * Persistence is delegated through a port so the kernel package does
 * not depend on `@bossnyumba/database`. The production adapter binds
 * `KernelSubstrateService`-style writers in the composition root.
 *
 * Capacity: 200 traces / tenant / day, oldest-evicted. Enforcement
 * lives in the port (a database trigger, or an LRU adapter). The
 * kernel records every step and submits the final trace; the limit is
 * enforced asynchronously, so a noisy tenant cannot drop the current
 * request's trace.
 *
 * Property-management context: step summaries reference the entities
 * the kernel actually touched (e.g. "policy gate redacted phone in
 * lease-arrears reply"), so when ops replays a trace they see real
 * domain decisions, not opaque step numbers.
 */

export type KernelStepName =
  | 'killswitch'
  | 'cache'
  | 'inviolable'
  | 'public-inviolable'
  | 'tier-compat'
  | 'memory-recall'
  | 'cohort-signal'
  | 'grounding-facts'
  | 'identity-render'
  | 'sensor-call'
  | 'debate'
  | 'normalize'
  | 'judge'
  | 'self-rag'
  | 'drift-check'
  | 'policy-gate'
  | 'confidence'
  | 'uncertainty-policy'
  | 'provenance-write'
  | 'cache-write'
  | 'episodic-write';

export interface KernelStepRecord {
  readonly step: KernelStepName;
  readonly durationMs: number;
  /** One-line human-readable summary of the step's decision/result. */
  readonly summary: string;
  /** Set when the step threw. The trace continues. */
  readonly error?: string;
}

export interface DecisionTrace {
  readonly thoughtId: string;
  readonly tenantId: string | null;
  readonly threadId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly totalDurationMs: number;
  readonly steps: ReadonlyArray<KernelStepRecord>;
  readonly outcome: 'answer' | 'softened' | 'refusal';
  readonly refusalGate?: 'inviolable' | 'policy' | 'drift' | 'killswitch' | 'uncertainty';
}

export interface DecisionTraceStore {
  /**
   * Persist a finalised trace. The store is fire-and-forget from the
   * kernel's perspective — failures must NOT bubble up. The store is
   * responsible for enforcing the 200/tenant/day cap.
   */
  record(trace: DecisionTrace): Promise<void>;
  /**
   * Read recent traces for a tenant. Used by the ops UI. Returns
   * newest-first.
   */
  recent(args: {
    readonly tenantId: string | null;
    readonly limit: number;
  }): Promise<ReadonlyArray<DecisionTrace>>;
}

export interface DecisionTraceRecorder {
  /**
   * Begin a new trace. Returns a writer scoped to one thought.
   */
  begin(args: {
    readonly thoughtId: string;
    readonly tenantId: string | null;
    readonly threadId: string;
  }): DecisionTraceWriter;
  /**
   * Read recent traces for an ops UI. Tenant-scoped. Limit must be
   * positive and ≤ 200 (the per-tenant cap).
   */
  getRecentTraces(
    tenantId: string | null,
    limit: number,
  ): Promise<ReadonlyArray<DecisionTrace>>;
}

export interface DecisionTraceWriter {
  /**
   * Record one step. Pure data; persistence happens at `finalize()`.
   * Each call returns a NEW writer so the caller can hold a single
   * `current` reference per request (no mutation).
   */
  step(record: KernelStepRecord): DecisionTraceWriter;
  /**
   * Finalise the trace and submit it to the store. Idempotent across
   * the underlying state — repeated calls return additional records
   * with the same `thoughtId` but extended step lists.
   */
  finalize(args: {
    readonly outcome: DecisionTrace['outcome'];
    readonly refusalGate?: DecisionTrace['refusalGate'];
  }): Promise<DecisionTrace>;
}

export interface CreateDecisionTraceRecorderArgs {
  readonly store: DecisionTraceStore;
  readonly clock?: () => Date;
}

const MAX_RECENT_LIMIT = 200;

export function createDecisionTraceRecorder(
  args: CreateDecisionTraceRecorderArgs,
): DecisionTraceRecorder {
  const clock = args.clock ?? (() => new Date());
  const store = args.store;

  return {
    begin(beginArgs) {
      const startedAt = clock();
      return makeWriter({
        store,
        clock,
        state: {
          thoughtId: beginArgs.thoughtId,
          tenantId: beginArgs.tenantId,
          threadId: beginArgs.threadId,
          startedAtIso: startedAt.toISOString(),
          startedAtMs: startedAt.getTime(),
          steps: [],
        },
      });
    },
    async getRecentTraces(tenantId, limit) {
      const safeLimit = clampLimit(limit);
      try {
        return await store.recent({ tenantId, limit: safeLimit });
      } catch {
        return [];
      }
    },
  };
}

interface WriterState {
  readonly thoughtId: string;
  readonly tenantId: string | null;
  readonly threadId: string;
  readonly startedAtIso: string;
  readonly startedAtMs: number;
  readonly steps: ReadonlyArray<KernelStepRecord>;
}

function makeWriter(args: {
  readonly store: DecisionTraceStore;
  readonly clock: () => Date;
  readonly state: WriterState;
}): DecisionTraceWriter {
  const { store, clock, state } = args;
  return {
    step(record: KernelStepRecord): DecisionTraceWriter {
      return makeWriter({
        store,
        clock,
        state: {
          ...state,
          steps: [...state.steps, normaliseRecord(record)],
        },
      });
    },
    async finalize(finArgs): Promise<DecisionTrace> {
      const finishedAt = clock();
      const totalDurationMs = Math.max(
        0,
        finishedAt.getTime() - state.startedAtMs,
      );
      const trace: DecisionTrace = {
        thoughtId: state.thoughtId,
        tenantId: state.tenantId,
        threadId: state.threadId,
        startedAt: state.startedAtIso,
        finishedAt: finishedAt.toISOString(),
        totalDurationMs,
        steps: state.steps,
        outcome: finArgs.outcome,
        ...(finArgs.refusalGate ? { refusalGate: finArgs.refusalGate } : {}),
      };
      try {
        await store.record(trace);
      } catch {
        // Side-channel — never break the main turn.
      }
      return trace;
    },
  };
}

function normaliseRecord(record: KernelStepRecord): KernelStepRecord {
  return {
    step: record.step,
    durationMs: Math.max(0, Math.round(record.durationMs)),
    summary: (record.summary ?? '').slice(0, SUMMARY_MAX),
    ...(record.error ? { error: record.error.slice(0, SUMMARY_MAX) } : {}),
  };
}

const SUMMARY_MAX = 200;

function clampLimit(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 1;
  if (n > MAX_RECENT_LIMIT) return MAX_RECENT_LIMIT;
  return Math.floor(n);
}

/**
 * In-memory store — useful for unit tests and the kernel's default
 * "no-op-with-tail" wiring. Enforces the 200/tenant/day cap.
 */
export function createInMemoryDecisionTraceStore(opts?: {
  readonly capacity?: number;
}): DecisionTraceStore & {
  /** Test helper: snapshot of all stored traces (newest first). */
  snapshot(): ReadonlyArray<DecisionTrace>;
} {
  const capacity = opts?.capacity ?? MAX_RECENT_LIMIT;
  // We hold an immutable list; every write replaces it.
  let traces: ReadonlyArray<DecisionTrace> = [];
  return {
    async record(trace) {
      const tenantKey = trace.tenantId ?? '__platform__';
      const others = traces.filter(
        (t) => (t.tenantId ?? '__platform__') !== tenantKey,
      );
      const sameTenant = traces.filter(
        (t) => (t.tenantId ?? '__platform__') === tenantKey,
      );
      // Prepend the new trace then trim to capacity (oldest evicted).
      const trimmed = [trace, ...sameTenant].slice(0, capacity);
      traces = [...trimmed, ...others];
    },
    async recent({ tenantId, limit }) {
      const tenantKey = tenantId ?? '__platform__';
      return traces
        .filter((t) => (t.tenantId ?? '__platform__') === tenantKey)
        .slice(0, clampLimit(limit));
    },
    snapshot() {
      return traces;
    },
  };
}
