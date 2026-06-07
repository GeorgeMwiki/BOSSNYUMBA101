/**
 * Loop actuators — the three ports that turn the orchestrator's
 * agentic-loop Decision variants from ACK-only stubs into REAL execution.
 *
 * The main loop (`main-loop.ts`) emits three transitional Decision
 * variants the dispatcher must ACTUATE, not merely acknowledge:
 *
 *   - `spawn_sub_md`   → fork a child Mr. Mwikila running its OWN
 *                        orchestrator loop on the sub-task (fire-and-
 *                        forget; the parent keeps looping).
 *   - `schedule_wake`  → pause now, resume the orchestrator later at a
 *                        durable wake time.
 *   - `monitor`        → register a watch (condition → re-invoke) and
 *                        yield.
 *
 * Each port has a SINGLE responsibility and the dispatcher consumes them
 * defensively: when a port is absent (null) the dispatcher DEGRADES —
 * it records the intent (never silently drops), logs honestly, and
 * returns the same ACK the main-loop already expects so the turn never
 * crashes. When a port is present the dispatcher executes the real
 * side-effect (durable enqueue / in-process background run / monitor
 * registration) and STILL returns the ACK.
 *
 * Discipline:
 *   - Pure ports. No concrete LLM / Inngest / DB import lives here — the
 *     composition root binds real impls (`registry-dispatcher-actuators.ts`)
 *     so this package type-checks without `inngest` installed.
 *   - Immutable. Inputs are `readonly`; impls never mutate caller args.
 *   - Recursion-safe. Spawns carry a `depth`; the dispatcher enforces a
 *     hard cap BEFORE invoking the spawner so a runaway self-spawn tree
 *     can never exhaust the host.
 */

import type { SubMdSpawn } from '../decision.js';
import type { ScopeContext } from '../../../types.js';

// ─────────────────────────────────────────────────────────────────────
// Sub-agent spawner — forks a child Mr. Mwikila on a sub-task.
// ─────────────────────────────────────────────────────────────────────

/**
 * Context threaded into every spawn so the child runs scoped to the
 * SAME tenant as the parent and so the recursion-depth governor can
 * refuse a spawn tree that nests past the cap.
 */
export interface SubAgentSpawnContext {
  /**
   * The parent's thread id. The child's thread id is derived from this +
   * the sub-MD id so a crash-replay re-keys deterministically.
   */
  readonly parentThreadId: string;
  /** Scope (tenant | platform) the child inherits from the parent turn. */
  readonly scope: ScopeContext;
  /**
   * Recursion depth of THIS spawn. The root turn is depth 0; the first
   * child is depth 1; a grandchild is depth 2. The dispatcher refuses
   * any spawn whose resulting child depth would exceed
   * `maxSpawnDepth` — fail-closed against runaway recursion.
   */
  readonly depth: number;
  /** Persona the parent ran under (the child inherits unless overridden). */
  readonly parentPersona: string;
}

/** Outcome of a spawn attempt the dispatcher folds onto a `spawn_ack`. */
export interface SubAgentSpawnHandle {
  /**
   * Stable handoff token the parent records on its `spawn_ack`. For a
   * durable enqueue this is the durable request id; for an in-process
   * background run it is a synthesised correlation id.
   */
  readonly handoffToken: string;
  /**
   * How the child was actually launched. `durable` = enqueued onto the
   * crash-resilient scheduler; `in-process` = spawned on a background
   * task in the current process (degrade when no durable infra);
   * `refused-depth` = the recursion cap blocked the spawn (the parent
   * still continues, the child never runs); `refused-concurrency` = the
   * process-wide in-flight semaphore was saturated (the parent continues,
   * the child never runs).
   */
  readonly mode:
    | 'durable'
    | 'in-process'
    | 'refused-depth'
    | 'refused-concurrency';
  /**
   * C2 — optional completion signal for fire-and-forget child turns. When
   * the spawner can observe the child's lifetime (e.g. the in-process
   * fallback that runs the child on a detached task), it resolves this
   * promise when the child finishes so the dispatcher releases its
   * in-flight-spawn slot at the RIGHT time (true concurrency cap, not just
   * admission control). Absent ⇒ the dispatcher releases the slot
   * immediately on spawn (admission-rate cap) — still bounded, never a
   * leak. The promise NEVER rejects: a child failure resolves it (the
   * spawner logs the failure separately).
   */
  readonly onSettled?: Promise<void>;
}

/**
 * Port the dispatcher calls to fork a child Mr. Mwikila. The prod impl
 * (composition root) enqueues a DURABLE job that runs a child
 * `kernel.think()` turn; the in-process fallback runs the child turn on a
 * detached background task. EITHER way the call resolves quickly with a
 * handle — the parent does NOT block on the child completing
 * (fire-and-forget).
 */
export interface SubAgentSpawner {
  /**
   * Launch a child orchestrator turn for `spawn`. MUST NOT throw — a
   * spawn-infra failure resolves to an `in-process` or a clearly-logged
   * degrade handle so the parent loop stays alive.
   */
  spawn(
    spawn: SubMdSpawn,
    ctx: SubAgentSpawnContext,
  ): Promise<SubAgentSpawnHandle>;
}

// ─────────────────────────────────────────────────────────────────────
// Wake scheduler — durable pause/resume of the orchestrator.
// ─────────────────────────────────────────────────────────────────────

/** A durable wake request the scheduler persists + re-fires later. */
export interface WakeRequest {
  /** Thread to revive when the wake fires. */
  readonly threadId: string;
  /** Absolute ISO timestamp the orchestrator should be re-invoked at. */
  readonly wakeAt: string;
  /** Human-readable reason carried into the audit + the resumed turn. */
  readonly reason: string;
  /** Scope the resumed turn re-enters under. */
  readonly scope: ScopeContext;
  /**
   * Token the wake handler passes back into `think()` so the resumed
   * turn can correlate to the original intent.
   */
  readonly resumeToken: string;
}

/** Outcome of a schedule attempt. */
export interface WakeScheduleHandle {
  /** Echo of the resume token the parent records on its `wake_ack`. */
  readonly resumeToken: string;
  /**
   * `durable` = persisted onto the crash-resilient scheduler (Inngest);
   * `in-process` = armed on the in-process wake supervisor — the resume
   * WILL fire at `wakeAt` via a process-local timer/heartbeat tick, but
   * the schedule is lost if the process restarts in the wait window
   * (real execution, NOT crash-resilient);
   * `recorded` = no active scheduler at all, the intent was recorded
   * (e.g. an audit / log / replay row) but NOT actively scheduled —
   * degrade, never a silent drop.
   */
  readonly mode: 'durable' | 'in-process' | 'recorded';
}

/**
 * Port the dispatcher calls to persist a wake. Prod enqueues a delayed
 * durable job keyed to the thread that re-invokes the orchestrator at
 * `wakeAt`. MUST NOT throw — a scheduler outage degrades to `recorded`.
 */
export interface WakeScheduler {
  schedule(req: WakeRequest): Promise<WakeScheduleHandle>;
}

// ─────────────────────────────────────────────────────────────────────
// Monitor registry — register a watch (condition → re-invoke) and yield.
// ─────────────────────────────────────────────────────────────────────

/** A monitor the registry persists so a later check can re-invoke. */
export interface MonitorRegistration {
  /** Stable id correlating the monitor to the yielding turn. */
  readonly watchId: string;
  /** Thread to revive when the predicate fires. */
  readonly threadId: string;
  /** Coarse predicate description (e.g. `rent.paid`, `inspection.failed`). */
  readonly predicate: string;
  /** Max wall-time the monitor stays armed before it self-expires. */
  readonly timeoutMs: number;
  /** Scope the re-invoked turn re-enters under. */
  readonly scope: ScopeContext;
}

/** Outcome of a monitor-register attempt. */
export interface MonitorRegisterHandle {
  /** Echo of the watch id the parent records on its `monitor_ack`. */
  readonly watchId: string;
  /**
   * `registered` = persisted onto a real recurring-check / DB registry
   * (durable, crash-resilient);
   * `in-process` = armed on the in-process monitor supervisor — the
   * predicate is polled by a process-local timer/heartbeat tick and the
   * resume fires when it trips (real execution, NOT crash-resilient;
   * the watch is lost on process restart). Only used when a REAL
   * predicate source (`monitorChecker`) is attested;
   * `recorded` = registry absent (or no predicate source attested),
   * intent recorded but not actively watched — degrade, never a silent
   * drop.
   */
  readonly mode: 'registered' | 'in-process' | 'recorded';
}

/**
 * Port the dispatcher calls to arm a monitor. Prod registers a durable
 * recurring check or a DB-persisted monitor row. MUST NOT throw — a
 * registry outage degrades to `recorded`.
 */
export interface MonitorRegistry {
  register(reg: MonitorRegistration): Promise<MonitorRegisterHandle>;
}

// ─────────────────────────────────────────────────────────────────────
// Bundle — one optional struct threaded through the dispatcher config.
// ─────────────────────────────────────────────────────────────────────

/**
 * The three loop actuators plus their governors, threaded through
 * `createRegistryDispatcher` from the composition root. Every field is
 * optional: a missing port makes ONLY its variant degrade gracefully;
 * the other variants are unaffected.
 */
export interface LoopActuators {
  /** Fork-a-child port. Null → spawn_sub_md degrades to a logged ACK. */
  readonly subAgentSpawner?: SubAgentSpawner;
  /** Durable-wake port. Null → schedule_wake degrades to a logged ACK. */
  readonly scheduler?: WakeScheduler;
  /** Watch-register port. Null → monitor degrades to a logged ACK. */
  readonly monitorRegistry?: MonitorRegistry;
  /**
   * Hard cap on sub-MD recursion depth. A spawn whose resulting child
   * depth would EXCEED this is refused cleanly (the parent continues).
   * Defaults to `DEFAULT_MAX_SPAWN_DEPTH`. A value of 0 forbids ALL
   * spawning (every spawn refuses at depth-cap).
   */
  readonly maxSpawnDepth?: number;
  /**
   * C1 — the depth of the CURRENT orchestrator turn used as a FALLBACK
   * when the per-turn `HookContext.spawnDepth` is absent. The dispatcher
   * is a process singleton, so this boot-time value alone is NON-
   * TRANSITIVE (it never changes per child turn). The dispatcher now reads
   * `ctx.spawnDepth` PER-TURN first and only falls back to this when the
   * context carries no depth. Defaults to 0 (root). Retained for
   * backward-compat + tests that exercise the dispatcher without threading
   * a per-turn ctx depth.
   */
  readonly currentDepth?: number;
  /**
   * C2 — per-turn breadth cap. The maximum number of `spawn_sub_md`
   * Decisions a SINGLE orchestrator turn may actuate. Without this, a turn
   * that emits N spawns × depth fans out N^depth children. A turn that
   * exceeds the count gets a clean degrade-ACK (NOT an unbounded fan-out).
   * Enforced in the main loop alongside the depth cap. Defaults to
   * `DEFAULT_MAX_SPAWNS_PER_TURN`. A value of 0 forbids ALL spawning.
   */
  readonly maxSpawnsPerTurn?: number;
  /**
   * C2 — process-wide in-flight-spawn ceiling. The maximum number of
   * concurrent child turns the spawner may have running at once across the
   * WHOLE process. A spawn attempted while the semaphore is saturated gets
   * a clean degrade-ACK (`refused-concurrency`) rather than piling on. The
   * dispatcher acquires a slot BEFORE invoking the spawner and the
   * fire-and-forget child releases it on completion. Defaults to
   * `DEFAULT_MAX_IN_FLIGHT_SPAWNS`.
   */
  readonly inFlightSpawns?: InFlightSpawnSemaphore;
}

/**
 * C2 — process-wide in-flight-spawn semaphore. A non-blocking counter the
 * dispatcher consults before launching a child turn: `tryAcquire()` returns
 * `false` (the dispatcher then degrade-ACKs) when the ceiling is reached, and
 * `release()` frees a slot when a child completes. Deliberately synchronous +
 * non-blocking — the orchestrator must NEVER await a free slot (that would
 * stall the parent turn); it refuses the excess spawn cleanly instead.
 */
export interface InFlightSpawnSemaphore {
  /** Try to take one slot. Returns true on success, false when saturated. */
  tryAcquire(): boolean;
  /** Release one slot previously taken. Idempotent-safe: never goes < 0. */
  release(): void;
  /** Current number of taken slots (diagnostics / tests). */
  inFlight(): number;
  /** The configured ceiling (diagnostics / tests). */
  readonly limit: number;
}

/**
 * Build a process-wide in-flight-spawn semaphore. One instance is shared by
 * the composition root across every dispatcher in the process so the ceiling
 * bounds the WHOLE spawn tree, not a single turn.
 */
export function createInFlightSpawnSemaphore(
  limit: number = DEFAULT_MAX_IN_FLIGHT_SPAWNS,
): InFlightSpawnSemaphore {
  const ceiling = Math.max(0, Math.floor(limit));
  let taken = 0;
  return {
    tryAcquire(): boolean {
      if (taken >= ceiling) return false;
      taken += 1;
      return true;
    },
    release(): void {
      if (taken > 0) taken -= 1;
    },
    inFlight(): number {
      return taken;
    },
    limit: ceiling,
  };
}

/**
 * Default recursion cap. A depth of 3 allows: root (0) → child (1) →
 * grandchild (2) → great-grandchild (3), then refuses depth-4 spawns.
 * Chosen conservatively — real property-ops fan-outs (eviction →
 * arrears-triage → comms-draft) rarely nest past 2; the 4th level is the
 * fail-closed ceiling against an LLM that loops on self-spawn.
 */
export const DEFAULT_MAX_SPAWN_DEPTH = 3;

/**
 * C2 — default per-turn breadth cap. A single turn may actuate at most 5
 * `spawn_sub_md` Decisions; the 6th refuses cleanly. Chosen small: a real
 * property-ops turn rarely needs to fan out to more than a handful of
 * sub-MDs at once, and bounding breadth × the depth cap keeps the worst-case
 * tree (5^3 = 125) far below a host-exhausting blow-up.
 */
export const DEFAULT_MAX_SPAWNS_PER_TURN = 5;

/**
 * C2 — default process-wide in-flight-spawn ceiling. At most 16 child turns
 * may run concurrently across the whole process. Bounds peak resource use
 * regardless of how many parent turns are live; excess spawns degrade-ACK.
 */
export const DEFAULT_MAX_IN_FLIGHT_SPAWNS = 16;

// ─────────────────────────────────────────────────────────────────────
// In-memory recorders — degrade-path sinks + deterministic test doubles.
//
// These are NOT the production impls (those live in the api-gateway
// composition root over Inngest + DB). They give the dispatcher a place
// to RECORD intent when the real port is absent, and tests a way to
// assert "the spawn/schedule/monitor intent was honoured, not dropped".
// ─────────────────────────────────────────────────────────────────────

/** A recorded spawn intent (degrade path). */
export interface RecordedSpawn {
  readonly subMdId: string;
  readonly parentThreadId: string;
  readonly depth: number;
}

/** A recorded wake intent (degrade path). */
export interface RecordedWake {
  readonly threadId: string;
  readonly wakeAt: string;
  readonly resumeToken: string;
}

/** A recorded monitor intent (degrade path). */
export interface RecordedMonitor {
  readonly watchId: string;
  readonly threadId: string;
  readonly predicate: string;
}

/**
 * In-memory `WakeScheduler` for tests + as a degrade-recorder the
 * composition root can pass when no durable infra is available so the
 * intent lands SOMEWHERE inspectable rather than only in the log.
 */
export interface InMemoryWakeScheduler extends WakeScheduler {
  recorded(): ReadonlyArray<RecordedWake>;
}

export function createInMemoryWakeScheduler(): InMemoryWakeScheduler {
  const rows: RecordedWake[] = [];
  return {
    async schedule(req) {
      rows.push({
        threadId: req.threadId,
        wakeAt: req.wakeAt,
        resumeToken: req.resumeToken,
      });
      return { resumeToken: req.resumeToken, mode: 'recorded' };
    },
    recorded() {
      return [...rows];
    },
  };
}

/** In-memory `MonitorRegistry` for tests + degrade-recording. */
export interface InMemoryMonitorRegistry extends MonitorRegistry {
  recorded(): ReadonlyArray<RecordedMonitor>;
}

export function createInMemoryMonitorRegistry(): InMemoryMonitorRegistry {
  const rows: RecordedMonitor[] = [];
  return {
    async register(reg) {
      rows.push({
        watchId: reg.watchId,
        threadId: reg.threadId,
        predicate: reg.predicate,
      });
      return { watchId: reg.watchId, mode: 'recorded' };
    },
    recorded() {
      return [...rows];
    },
  };
}

/** In-memory `SubAgentSpawner` for tests. Records every spawn it sees. */
export interface InMemorySubAgentSpawner extends SubAgentSpawner {
  recorded(): ReadonlyArray<RecordedSpawn>;
}

export function createInMemorySubAgentSpawner(): InMemorySubAgentSpawner {
  const rows: RecordedSpawn[] = [];
  return {
    async spawn(spawn, ctx) {
      rows.push({
        subMdId: spawn.subMdId,
        parentThreadId: ctx.parentThreadId,
        depth: ctx.depth,
      });
      return {
        handoffToken: `inproc:${spawn.subMdId}`,
        mode: 'in-process',
      };
    },
    recorded() {
      return [...rows];
    },
  };
}
