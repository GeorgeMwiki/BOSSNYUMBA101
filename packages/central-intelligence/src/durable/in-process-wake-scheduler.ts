/**
 * In-process wake (+ monitor) supervisor — the DEPLOY-FREE actuator for the
 * orchestrator's `schedule_wake` / `monitor` Decisions.
 *
 * Motivation
 * ----------
 * The durable loop actuators (`durable-loop-actuators.ts`) turn `schedule_wake`
 * / `monitor` into crash-resilient suspend/resume, but ONLY when an Inngest
 * worker + creds are deployed (`DURABLE_EXEC_ENABLED=true` AND a consumer is
 * registered). Until that infra exists those producers honestly degrade to
 * `recorded` — the brain knows it was NOT actually scheduled. That leaves the
 * orchestrator unable to wake itself in the default (no-Inngest) deployment.
 *
 * This module closes that gap WITHOUT any deploy dependency: an in-process
 * supervisor that holds pending wakes/monitors in memory and fires them on a
 * tick. The tick is driven two ways (belt-and-braces):
 *
 *   1. `start()` arms an internal `setInterval(tick, tickIntervalMs)` so the
 *      supervisor self-drives even if nothing else calls it.
 *   2. `tick(now)` is ALSO public so an existing heartbeat / wake-loop cron
 *      can drive it on its own cadence (one source of truth for "wall clock
 *      advanced"). Calling both is safe — a fired wake is removed atomically
 *      so it never double-fires.
 *
 * Honesty contract
 * ----------------
 *   - WAKE is real here: `schedule()` arms a timer that WILL invoke the bound
 *     `ResumeTurnRunner` at `wakeAt`. The returned handle mode is
 *     `'in-process'` (NOT `'durable'`) because the schedule is process-local:
 *     a restart in the wait window loses it. That is the truthful mode — it
 *     executes, but it is not crash-resilient.
 *   - MONITOR is only armed in-process when a REAL predicate source is
 *     attested (`monitorAvailable === true` AND a non-stub `monitorChecker`).
 *     Arming a poll backed by an always-false stub is a guaranteed never-fire
 *     that the caller would mistake for an active watch — so without a real
 *     source `register()` degrade-records (`'recorded'`) and logs precisely
 *     what is missing. NEVER a fake "registered".
 *
 * Decoupling
 * ----------
 * Imports ONLY the orchestrator's loop-actuator port TYPES + the durable
 * runner port types (`ResumeTurnRunner`, `MonitorChecker`). It NEVER imports
 * the concrete kernel, Anthropic SDK, Drizzle, or `inngest` — the composition
 * root binds the runner callbacks (to `kernel.think()`), exactly as it does
 * for the durable actuators. So this package type-checks + tests without any
 * of that installed.
 *
 * Immutability: inputs are `readonly`; pending entries are replaced, never
 * mutated. The producers NEVER throw — a fault degrades to a logged
 * `recorded` handle so the parent orchestrator turn always stays alive.
 */

import type {
  MonitorRegisterHandle,
  MonitorRegistration,
  MonitorRegistry,
  WakeRequest,
  WakeScheduleHandle,
  WakeScheduler,
} from '../kernel/orchestrator/adapters/loop-actuators.js';
import type {
  MonitorChecker,
  ResumeTurnRunner,
} from './durable-loop-actuators.js';

/** Structural logger — same shape the durable actuators accept. */
export interface InProcessSupervisorLogger {
  info?(meta: object, msg: string): void;
  warn?(meta: object, msg: string): void;
  error?(meta: object, msg: string): void;
}

export interface InProcessWakeSchedulerDeps {
  /**
   * Resumes a woken thread — the composition root binds this to
   * `kernel.think()` for the wake. Called once per fired wake. MUST NOT be
   * relied on to throw for control flow; a rejection is caught + logged.
   */
  readonly resumeTurnRunner: ResumeTurnRunner;
  /**
   * Re-invokes the orchestrator when a monitor predicate fires. Bound to
   * `kernel.think()` by the caller. Only used when monitors are armed
   * in-process (`monitorAvailable === true`).
   */
  readonly monitorResumeRunner?: ResumeTurnRunner;
  /**
   * Evaluates a monitor's predicate per tick. MUST be cheap + idempotent.
   * Only consulted when `monitorAvailable === true`; without it (or with the
   * always-false stub) monitors degrade-record instead of arming.
   */
  readonly monitorChecker?: MonitorChecker;
  /**
   * M2 — monitor-predicate availability attestation. `register()` only arms
   * an in-process watch when this is `true` AND a `monitorChecker` is bound.
   * Default `false` (no real predicate source ⇒ honest degrade-record).
   */
  readonly monitorAvailable?: boolean;
  /**
   * Self-drive cadence (ms) for `start()`. The supervisor also accepts
   * external `tick()` calls; this is just the floor so it makes progress
   * unattended. Default 30s (matches the gateway heartbeat cadence). Bounded
   * to [1s, 1h] so a misconfig can never busy-spin or stall for a day.
   */
  readonly tickIntervalMs?: number;
  /** Clock injection (tests). Defaults to `Date.now`. */
  readonly clock?: () => number;
  readonly logger?: InProcessSupervisorLogger;
}

/** A wake armed on the in-process supervisor. */
interface PendingWake {
  readonly threadId: string;
  /** Epoch ms the resume should fire at. */
  readonly wakeAtMs: number;
  readonly reason: string;
  readonly resumeToken: string;
  readonly scope: WakeRequest['scope'];
}

/** A monitor armed on the in-process supervisor. */
interface ArmedMonitor {
  readonly watchId: string;
  readonly threadId: string;
  readonly predicate: string;
  /** Epoch ms the watch self-expires at (armedAt + timeoutMs). */
  readonly expiresAtMs: number;
  readonly scope: MonitorRegistration['scope'];
}

/**
 * Public surface — the two loop-actuator ports plus the supervisor lifecycle.
 * One instance is shared across the process so a single tick fires every
 * pending wake/monitor regardless of which dispatcher armed it.
 */
export interface InProcessWakeSupervisor {
  /** The `WakeScheduler` port to thread into the registry dispatcher. */
  readonly scheduler: WakeScheduler;
  /**
   * The `MonitorRegistry` port. Arms in-process when a predicate source is
   * attested; degrade-records otherwise (honest, never a fake watch).
   */
  readonly monitorRegistry: MonitorRegistry;
  /**
   * Advance the supervisor to `now`: fire every due wake (wakeAt <= now) and
   * poll every armed monitor (fire on trip, expire on timeout). Idempotent —
   * a fired/expired entry is removed before its runner is invoked so a
   * concurrent tick never double-fires it. Resolves when all fired runners
   * settle (never rejects). `now` defaults to the injected clock.
   */
  tick(now?: number): Promise<InProcessTickOutcome>;
  /** Arm the internal self-drive interval. Idempotent. */
  start(): void;
  /** Clear the internal interval. Idempotent. Pending entries are retained. */
  stop(): void;
  /** Count of wakes currently armed (diagnostics / tests). */
  pendingWakeCount(): number;
  /** Count of monitors currently armed (diagnostics / tests). */
  armedMonitorCount(): number;
}

export interface InProcessTickOutcome {
  readonly wakesFired: number;
  readonly monitorsFired: number;
  readonly monitorsExpired: number;
}

const DEFAULT_TICK_INTERVAL_MS = 30_000;
const MIN_TICK_INTERVAL_MS = 1_000;
const MAX_TICK_INTERVAL_MS = 60 * 60 * 1000;

function clampTickInterval(ms: number | undefined): number {
  const candidate =
    typeof ms === 'number' && Number.isFinite(ms) && ms > 0
      ? ms
      : DEFAULT_TICK_INTERVAL_MS;
  return Math.min(
    MAX_TICK_INTERVAL_MS,
    Math.max(MIN_TICK_INTERVAL_MS, Math.floor(candidate)),
  );
}

function parseWakeAtMs(wakeAt: string, fallbackNow: number): number {
  const parsed = Date.parse(wakeAt);
  // An unparseable wakeAt would otherwise become NaN and never fire (NaN
  // comparisons are always false). Fail SAFE: fire on the next tick rather
  // than silently never resuming the turn.
  return Number.isFinite(parsed) ? parsed : fallbackNow;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Build the in-process wake/monitor supervisor.
 *
 * The two returned ports (`scheduler`, `monitorRegistry`) are the prod-default
 * actuators threaded into `createRegistryDispatcher({ loopActuators })` by the
 * composition root. They execute in-process with NO Inngest dependency.
 */
export function createInProcessWakeScheduler(
  deps: InProcessWakeSchedulerDeps,
): InProcessWakeSupervisor {
  const clock = deps.clock ?? Date.now;
  const tickIntervalMs = clampTickInterval(deps.tickIntervalMs);
  const monitorArmable =
    deps.monitorAvailable === true &&
    typeof deps.monitorChecker === 'function' &&
    typeof deps.monitorResumeRunner === 'function';

  // Keyed by resumeToken / watchId so a re-arm of the SAME intent replaces
  // (never duplicates) the pending entry — idempotent against a turn that
  // retries its schedule.
  const pendingWakes = new Map<string, PendingWake>();
  const armedMonitors = new Map<string, ArmedMonitor>();

  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  // A non-reentrancy guard so a slow tick (an awaited runner) cannot overlap
  // the next interval-driven tick and double-poll a monitor.
  let ticking = false;

  // ─────────────────────────────────────────────────────────────────────
  // WakeScheduler port — arm a real in-process resume.
  // ─────────────────────────────────────────────────────────────────────
  const scheduler: WakeScheduler = {
    async schedule(req: WakeRequest): Promise<WakeScheduleHandle> {
      try {
        const now = clock();
        pendingWakes.set(req.resumeToken, {
          threadId: req.threadId,
          wakeAtMs: parseWakeAtMs(req.wakeAt, now),
          reason: req.reason,
          resumeToken: req.resumeToken,
          scope: req.scope,
        });
        deps.logger?.info?.(
          {
            threadId: req.threadId,
            wakeAt: req.wakeAt,
            resumeToken: req.resumeToken,
            pending: pendingWakes.size,
          },
          'in-process-wake-scheduler: wake armed (in-process; fires on tick)',
        );
        return { resumeToken: req.resumeToken, mode: 'in-process' };
      } catch (err) {
        // A producer must NEVER throw — degrade to a recorded handle so the
        // parent turn stays alive. (Map.set throwing is essentially
        // impossible, but the contract is absolute.)
        deps.logger?.warn?.(
          { err: errMessage(err), threadId: req.threadId },
          'in-process-wake-scheduler: wake arm failed; degraded to recorded',
        );
        return { resumeToken: req.resumeToken, mode: 'recorded' };
      }
    },
  };

  // ─────────────────────────────────────────────────────────────────────
  // MonitorRegistry port — arm a real in-process poll ONLY when a predicate
  // source is attested; otherwise honest degrade-record.
  // ─────────────────────────────────────────────────────────────────────
  const monitorRegistry: MonitorRegistry = {
    async register(reg: MonitorRegistration): Promise<MonitorRegisterHandle> {
      if (!monitorArmable) {
        // No real predicate source ⇒ do NOT pretend to watch. Record + log
        // precisely what is missing so the gap is auditable, not silent.
        deps.logger?.warn?.(
          {
            watchId: reg.watchId,
            threadId: reg.threadId,
            predicate: reg.predicate,
            need: 'monitorAvailable=true + a real monitorChecker + monitorResumeRunner',
          },
          'in-process-wake-scheduler: monitor NOT armed (no in-process predicate source); recorded',
        );
        return { watchId: reg.watchId, mode: 'recorded' };
      }
      try {
        const now = clock();
        armedMonitors.set(reg.watchId, {
          watchId: reg.watchId,
          threadId: reg.threadId,
          predicate: reg.predicate,
          expiresAtMs: now + Math.max(0, reg.timeoutMs),
          scope: reg.scope,
        });
        deps.logger?.info?.(
          {
            watchId: reg.watchId,
            threadId: reg.threadId,
            predicate: reg.predicate,
            timeoutMs: reg.timeoutMs,
            armed: armedMonitors.size,
          },
          'in-process-wake-scheduler: monitor armed (in-process poll)',
        );
        return { watchId: reg.watchId, mode: 'in-process' };
      } catch (err) {
        deps.logger?.warn?.(
          { err: errMessage(err), watchId: reg.watchId },
          'in-process-wake-scheduler: monitor arm failed; degraded to recorded',
        );
        return { watchId: reg.watchId, mode: 'recorded' };
      }
    },
  };

  // ─────────────────────────────────────────────────────────────────────
  // Tick — fire due wakes + poll armed monitors. Removes each entry BEFORE
  // invoking its runner so a re-entrant tick never double-fires it.
  // ─────────────────────────────────────────────────────────────────────
  async function fireDueWakes(now: number): Promise<number> {
    const due: PendingWake[] = [];
    for (const wake of pendingWakes.values()) {
      if (wake.wakeAtMs <= now) due.push(wake);
    }
    for (const wake of due) {
      pendingWakes.delete(wake.resumeToken);
    }
    let fired = 0;
    for (const wake of due) {
      try {
        await deps.resumeTurnRunner({
          threadId: wake.threadId,
          reason: wake.reason,
          resumeToken: wake.resumeToken,
          scope: wake.scope,
        });
        fired += 1;
      } catch (err) {
        // A resume fault must not stop the other due wakes — log + continue.
        deps.logger?.error?.(
          { err: errMessage(err), threadId: wake.threadId, resumeToken: wake.resumeToken },
          'in-process-wake-scheduler: wake resume failed',
        );
      }
    }
    return fired;
  }

  async function pollArmedMonitors(
    now: number,
  ): Promise<{ fired: number; expired: number }> {
    if (!monitorArmable) return { fired: 0, expired: 0 };
    // monitorArmable guarantees these are bound; narrow once for the closure.
    const checker = deps.monitorChecker as MonitorChecker;
    const resume = deps.monitorResumeRunner as ResumeTurnRunner;
    let fired = 0;
    let expired = 0;
    // Snapshot the current watches so a watch armed mid-tick is not polled
    // until the next tick (deterministic per-tick set).
    const watches = [...armedMonitors.values()];
    for (const mon of watches) {
      let tripped = false;
      try {
        tripped = await checker({
          watchId: mon.watchId,
          predicate: mon.predicate,
          scope: mon.scope,
        });
      } catch (err) {
        // A checker fault is non-fatal — skip this watch this tick (it stays
        // armed until it expires or a later check succeeds).
        deps.logger?.warn?.(
          { err: errMessage(err), watchId: mon.watchId, predicate: mon.predicate },
          'in-process-wake-scheduler: monitor checker failed (watch retained)',
        );
        continue;
      }
      if (tripped) {
        // Remove BEFORE resuming so a re-entrant tick never re-fires it.
        armedMonitors.delete(mon.watchId);
        try {
          await resume({
            threadId: mon.threadId,
            reason: `monitor:${mon.predicate}`,
            resumeToken: `monitor:${mon.watchId}`,
            scope: mon.scope,
          });
          fired += 1;
        } catch (err) {
          deps.logger?.error?.(
            { err: errMessage(err), watchId: mon.watchId },
            'in-process-wake-scheduler: monitor resume failed',
          );
        }
        continue;
      }
      if (mon.expiresAtMs <= now) {
        armedMonitors.delete(mon.watchId);
        expired += 1;
        deps.logger?.info?.(
          { watchId: mon.watchId, threadId: mon.threadId, predicate: mon.predicate },
          'in-process-wake-scheduler: monitor expired without firing',
        );
      }
    }
    return { fired, expired };
  }

  async function tick(now?: number): Promise<InProcessTickOutcome> {
    if (ticking) {
      // Overlapping tick (a prior awaited runner is still settling). Skip so
      // we never double-poll; the in-flight tick already covers `now`.
      return { wakesFired: 0, monitorsFired: 0, monitorsExpired: 0 };
    }
    ticking = true;
    try {
      const at = typeof now === 'number' ? now : clock();
      const wakesFired = await fireDueWakes(at);
      const { fired: monitorsFired, expired: monitorsExpired } =
        await pollArmedMonitors(at);
      return { wakesFired, monitorsFired, monitorsExpired };
    } catch (err) {
      // Defensive — fireDueWakes / pollArmedMonitors already isolate every
      // runner. A throw before either entered must not crash the host.
      deps.logger?.error?.(
        { err: errMessage(err) },
        'in-process-wake-scheduler: tick failed',
      );
      return { wakesFired: 0, monitorsFired: 0, monitorsExpired: 0 };
    } finally {
      ticking = false;
    }
  }

  return {
    scheduler,
    monitorRegistry,
    tick,
    start() {
      if (intervalHandle) return;
      intervalHandle = setInterval(() => {
        void tick();
      }, tickIntervalMs);
      // Do not keep the event loop alive purely for this timer.
      if (typeof intervalHandle.unref === 'function') intervalHandle.unref();
      deps.logger?.info?.(
        { tickIntervalMs, monitorArmable },
        'in-process-wake-scheduler: started',
      );
    },
    stop() {
      if (!intervalHandle) return;
      clearInterval(intervalHandle);
      intervalHandle = null;
      deps.logger?.info?.({}, 'in-process-wake-scheduler: stopped');
    },
    pendingWakeCount() {
      return pendingWakes.size;
    },
    armedMonitorCount() {
      return armedMonitors.size;
    },
  };
}
