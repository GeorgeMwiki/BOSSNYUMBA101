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
 * Durability (the upgrade)
 * ------------------------
 * The supervisor can be made CRASH-RESILIENT by binding an optional
 * `DurableWakeStore` (a PURE async port; the composition root implements it
 * over Postgres/Drizzle). When a store is bound:
 *
 *   - `schedule()` / `register()` PERSIST the armed entry to the store BEFORE
 *     returning, so a restart in the wait window can rehydrate it. The handle
 *     mode upgrades to `'durable'` / `'registered'` (truthfully crash-
 *     resilient) instead of the process-local `'in-process'`.
 *   - A fired/expired entry is DELETED from the store (best-effort) so a
 *     rehydrate after restart never re-fires a wake that already ran.
 *   - `rehydrate()` (called once at boot by the composition root) reloads
 *     every still-pending wake/monitor from the store back into memory so the
 *     tick resumes them. This is what makes "wake me when X" survive redeploy.
 *
 * When NO store is bound the supervisor behaves exactly as before — an
 * in-process, lost-on-restart actuator with the honest `'in-process'` mode.
 * That is now the EXPLICIT FALLBACK, not the default, whenever a store is
 * configured at the composition root.
 *
 * Honesty contract
 * ----------------
 *   - WAKE is real here: `schedule()` arms a timer that WILL invoke the bound
 *     `ResumeTurnRunner` at `wakeAt`. The returned handle mode is `'durable'`
 *     when a store persisted it (survives restart) and the honest
 *     `'in-process'` (NOT `'durable'`) when no store is bound — the schedule is
 *     then process-local and a restart in the wait window loses it.
 *   - MONITOR is only armed in-process when a REAL predicate source is
 *     attested (`monitorAvailable === true` AND a non-stub `monitorChecker`).
 *     Arming a poll backed by an always-false stub is a guaranteed never-fire
 *     that the caller would mistake for an active watch — so without a real
 *     source `register()` degrade-records (`'recorded'`) and logs precisely
 *     what is missing. NEVER a fake "registered". When a store IS bound the
 *     armed monitor mode upgrades to `'registered'` (crash-resilient).
 *
 * Decoupling
 * ----------
 * Imports ONLY the orchestrator's loop-actuator port TYPES + the durable
 * runner port types (`ResumeTurnRunner`, `MonitorChecker`) + the pure
 * `DurableWakeStore` port DEFINED HERE. It NEVER imports the concrete kernel,
 * Anthropic SDK, Drizzle, or `inngest` — the composition root binds the runner
 * callbacks (to `kernel.think()`) and the store impl (over Postgres), exactly
 * as it does for the durable actuators. So this package type-checks + tests
 * without any of that installed.
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

// ─────────────────────────────────────────────────────────────────────
// Durable backing-store port — the seam that makes armed wakes/monitors
// survive a process restart. PURE: the composition root implements it over
// Postgres (Drizzle). This module never imports the DB — it only calls the
// port. Every method MUST resolve/reject quickly; the supervisor isolates a
// rejection (logs + degrades to a process-local arm) so a store outage never
// drops the intent or crashes the parent turn.
// ─────────────────────────────────────────────────────────────────────

/** A wake row as persisted to / loaded from the durable store. */
export interface PersistedWakeRecord {
  readonly threadId: string;
  /** Epoch ms the resume should fire at. */
  readonly wakeAtMs: number;
  readonly reason: string;
  readonly resumeToken: string;
  readonly scope: WakeRequest['scope'];
}

/** A monitor row as persisted to / loaded from the durable store. */
export interface PersistedMonitorRecord {
  readonly watchId: string;
  readonly threadId: string;
  readonly predicate: string;
  /** Epoch ms the watch self-expires at. */
  readonly expiresAtMs: number;
  readonly scope: MonitorRegistration['scope'];
}

/** The pending set rehydrated from the store at boot. */
export interface PersistedPendingSet {
  readonly wakes: ReadonlyArray<PersistedWakeRecord>;
  readonly monitors: ReadonlyArray<PersistedMonitorRecord>;
}

/**
 * Durable backing store for armed wakes + monitors. Bound by the composition
 * root over Postgres so the in-process supervisor becomes crash-resilient:
 * persisted entries are reloaded by `rehydrate()` after a restart.
 *
 * Contract:
 *   - `saveWake` / `saveMonitor` UPSERT by `resumeToken` / `watchId` (re-arming
 *     the SAME intent replaces, never duplicates).
 *   - `deleteWake` / `deleteMonitor` remove a fired/expired entry so a later
 *     rehydrate never re-fires it. Deleting a missing key is a no-op.
 *   - `loadPending` returns every still-pending entry (the supervisor itself
 *     re-evaluates due/expiry against the wall clock after load).
 *   - Methods MAY reject; the supervisor catches + degrades. They MUST NOT be
 *     relied on to throw for control flow.
 */
export interface DurableWakeStore {
  saveWake(record: PersistedWakeRecord): Promise<void>;
  deleteWake(resumeToken: string): Promise<void>;
  saveMonitor(record: PersistedMonitorRecord): Promise<void>;
  deleteMonitor(watchId: string): Promise<void>;
  loadPending(): Promise<PersistedPendingSet>;
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
  /**
   * Optional durable backing store. When bound the supervisor PERSISTS every
   * armed wake/monitor and reports the crash-resilient handle modes
   * (`'durable'` / `'registered'`); `rehydrate()` reloads them after a restart.
   * Absent ⇒ process-local arming with the honest `'in-process'` mode (lost on
   * restart). The composition root makes this the DEFAULT when a backing table
   * is configured; the storeless mode is then the explicit fallback only.
   */
  readonly store?: DurableWakeStore;
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
  /**
   * Reload every still-pending wake/monitor from the durable store back into
   * memory. Called ONCE by the composition root at boot, BEFORE `start()`, so a
   * wake armed before a restart resumes on the next tick. A no-op (resolves to
   * a zero outcome) when no store is bound. NEVER rejects — a store fault is
   * logged and the supervisor simply starts with whatever loaded (degrade).
   */
  rehydrate(): Promise<RehydrateOutcome>;
  /** Arm the internal self-drive interval. Idempotent. */
  start(): void;
  /** Clear the internal interval. Idempotent. Pending entries are retained. */
  stop(): void;
  /**
   * Whether a durable backing store is bound (armed wakes survive restart).
   * `false` ⇒ the explicit process-local fallback (lost on restart).
   */
  readonly durable: boolean;
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

export interface RehydrateOutcome {
  /** Wakes reloaded into memory from the durable store. */
  readonly wakesLoaded: number;
  /** Monitors reloaded into memory from the durable store. */
  readonly monitorsLoaded: number;
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
  const store = deps.store;
  const isDurable = store != null;
  // Crash-resilient handle modes when a store persisted the entry; the honest
  // process-local modes when no store is bound.
  const wakeMode: WakeScheduleHandle['mode'] = isDurable ? 'durable' : 'in-process';
  const monitorMode: MonitorRegisterHandle['mode'] = isDurable
    ? 'registered'
    : 'in-process';

  /**
   * Best-effort durable-store write. A store fault must NEVER drop the in-
   * memory arm or crash the parent turn — the entry still fires on this
   * process's tick (it just won't survive a restart). Log + continue.
   */
  async function persistWake(record: PersistedWakeRecord): Promise<void> {
    if (!store) return;
    try {
      await store.saveWake(record);
    } catch (err) {
      deps.logger?.warn?.(
        { err: errMessage(err), resumeToken: record.resumeToken },
        'in-process-wake-scheduler: durable saveWake failed (armed in-process only)',
      );
    }
  }
  async function forgetWake(resumeToken: string): Promise<void> {
    if (!store) return;
    try {
      await store.deleteWake(resumeToken);
    } catch (err) {
      deps.logger?.warn?.(
        { err: errMessage(err), resumeToken },
        'in-process-wake-scheduler: durable deleteWake failed (in-memory removed)',
      );
    }
  }
  async function persistMonitor(record: PersistedMonitorRecord): Promise<void> {
    if (!store) return;
    try {
      await store.saveMonitor(record);
    } catch (err) {
      deps.logger?.warn?.(
        { err: errMessage(err), watchId: record.watchId },
        'in-process-wake-scheduler: durable saveMonitor failed (armed in-process only)',
      );
    }
  }
  async function forgetMonitor(watchId: string): Promise<void> {
    if (!store) return;
    try {
      await store.deleteMonitor(watchId);
    } catch (err) {
      deps.logger?.warn?.(
        { err: errMessage(err), watchId },
        'in-process-wake-scheduler: durable deleteMonitor failed (in-memory removed)',
      );
    }
  }

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
        const entry: PendingWake = {
          threadId: req.threadId,
          wakeAtMs: parseWakeAtMs(req.wakeAt, now),
          reason: req.reason,
          resumeToken: req.resumeToken,
          scope: req.scope,
        };
        pendingWakes.set(req.resumeToken, entry);
        // Persist BEFORE returning so a restart in the wait window rehydrates
        // it. Best-effort: a store fault still leaves the in-memory arm live.
        await persistWake(entry);
        deps.logger?.info?.(
          {
            threadId: req.threadId,
            wakeAt: req.wakeAt,
            resumeToken: req.resumeToken,
            pending: pendingWakes.size,
            mode: wakeMode,
          },
          isDurable
            ? 'in-process-wake-scheduler: wake armed (durable; survives restart, fires on tick)'
            : 'in-process-wake-scheduler: wake armed (in-process; fires on tick)',
        );
        return { resumeToken: req.resumeToken, mode: wakeMode };
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
        const entry: ArmedMonitor = {
          watchId: reg.watchId,
          threadId: reg.threadId,
          predicate: reg.predicate,
          expiresAtMs: now + Math.max(0, reg.timeoutMs),
          scope: reg.scope,
        };
        armedMonitors.set(reg.watchId, entry);
        // Persist BEFORE returning so a restart rehydrates the watch.
        await persistMonitor(entry);
        deps.logger?.info?.(
          {
            watchId: reg.watchId,
            threadId: reg.threadId,
            predicate: reg.predicate,
            timeoutMs: reg.timeoutMs,
            armed: armedMonitors.size,
            mode: monitorMode,
          },
          isDurable
            ? 'in-process-wake-scheduler: monitor armed (durable poll; survives restart)'
            : 'in-process-wake-scheduler: monitor armed (in-process poll)',
        );
        return { watchId: reg.watchId, mode: monitorMode };
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
      // Remove from the durable store BEFORE invoking the runner so a crash
      // mid-resume (or a concurrent rehydrate) can never re-fire the wake.
      await forgetWake(wake.resumeToken);
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
        await forgetMonitor(mon.watchId);
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
        await forgetMonitor(mon.watchId);
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

  // ─────────────────────────────────────────────────────────────────────
  // Rehydrate — reload still-pending wakes/monitors from the store at boot so
  // an arm made before a restart resumes on the next tick. A monitor is only
  // re-armed in memory when the predicate source is attested (same honesty
  // rule as `register()`); a watch loaded without an armable checker is left
  // in the store but logged, not silently armed against an always-false stub.
  // ─────────────────────────────────────────────────────────────────────
  async function rehydrate(): Promise<RehydrateOutcome> {
    if (!store) return { wakesLoaded: 0, monitorsLoaded: 0 };
    let pending: PersistedPendingSet;
    try {
      pending = await store.loadPending();
    } catch (err) {
      deps.logger?.error?.(
        { err: errMessage(err) },
        'in-process-wake-scheduler: rehydrate failed (starting with empty pending set)',
      );
      return { wakesLoaded: 0, monitorsLoaded: 0 };
    }
    let wakesLoaded = 0;
    for (const w of pending.wakes) {
      // Replace (never duplicate) — the same resumeToken keys one entry.
      pendingWakes.set(w.resumeToken, {
        threadId: w.threadId,
        wakeAtMs: w.wakeAtMs,
        reason: w.reason,
        resumeToken: w.resumeToken,
        scope: w.scope,
      });
      wakesLoaded += 1;
    }
    let monitorsLoaded = 0;
    for (const m of pending.monitors) {
      if (!monitorArmable) {
        deps.logger?.warn?.(
          { watchId: m.watchId, predicate: m.predicate },
          'in-process-wake-scheduler: monitor in store NOT re-armed (no predicate source); left persisted',
        );
        continue;
      }
      armedMonitors.set(m.watchId, {
        watchId: m.watchId,
        threadId: m.threadId,
        predicate: m.predicate,
        expiresAtMs: m.expiresAtMs,
        scope: m.scope,
      });
      monitorsLoaded += 1;
    }
    deps.logger?.info?.(
      { wakesLoaded, monitorsLoaded },
      'in-process-wake-scheduler: rehydrated armed wakes/monitors from durable store',
    );
    return { wakesLoaded, monitorsLoaded };
  }

  return {
    scheduler,
    monitorRegistry,
    tick,
    rehydrate,
    durable: isDurable,
    start() {
      if (intervalHandle) return;
      intervalHandle = setInterval(() => {
        void tick();
      }, tickIntervalMs);
      // Do not keep the event loop alive purely for this timer.
      if (typeof intervalHandle.unref === 'function') intervalHandle.unref();
      deps.logger?.info?.(
        { tickIntervalMs, monitorArmable, durable: isDurable },
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
