/**
 * Durable loop actuators — production-grade impls of the orchestrator's
 * three agentic-loop ports (`SubAgentSpawner`, `WakeScheduler`,
 * `MonitorRegistry`) backed by the Inngest durable-execution layer.
 *
 * These are what turn the main-loop's `spawn_sub_md` / `schedule_wake` /
 * `monitor` Decisions from ACK-only stubs into crash-resilient real
 * execution:
 *
 *   - spawn_sub_md  → enqueue an `orchestrator/sub-md.spawn.requested`
 *                     event. The registered durable function runs ONE
 *                     child orchestrator turn via the injected
 *                     `ChildTurnRunner` (the composition root binds this
 *                     to `kernel.think()` for a child sub-MD instance).
 *                     The producer returns immediately → fire-and-forget.
 *   - schedule_wake → enqueue an `orchestrator/wake.requested` event. The
 *                     durable function `step.sleepUntil(wakeAt)` to
 *                     suspend, then re-invokes the orchestrator via the
 *                     injected `ResumeTurnRunner`. Survives any number of
 *                     process restarts in the wait window.
 *   - monitor       → enqueue an `orchestrator/monitor.armed` event. The
 *                     durable function arms a bounded poll loop (sleep →
 *                     check predicate → re-invoke on fire / expire on
 *                     timeout) via the injected `MonitorChecker`.
 *
 * Decoupling: this module imports ONLY the structural Inngest ports
 * (`InngestComposition`, `DurableStepLike`) and the orchestrator's
 * loop-actuator port TYPES. It NEVER imports the concrete kernel, the
 * Anthropic SDK, or Drizzle — the composition root injects those behind
 * the three runner callbacks. So the package type-checks and tests run
 * without `inngest` installed.
 *
 * Degrade-by-construction: when `composition.enabled === false` (no
 * `DURABLE_EXEC_ENABLED=true` / no Inngest), every port runs its
 * in-process / recorded fallback instead of enqueuing — the intent is
 * NEVER silently dropped.
 */

import type {
  DurableFunctionContext,
  DurableFunctionDefinition,
  DurableStepLike,
  InngestComposition,
} from './inngest-client.js';
import type {
  LoopActuators,
  MonitorRegistration,
  MonitorRegisterHandle,
  MonitorRegistry,
  SubAgentSpawner,
  SubAgentSpawnContext,
  SubAgentSpawnHandle,
  WakeRequest,
  WakeScheduleHandle,
  WakeScheduler,
} from '../kernel/orchestrator/adapters/loop-actuators.js';
import type { SubMdSpawn } from '../kernel/orchestrator/decision.js';
import type { ScopeContext } from '../types.js';

// ---------------------------------------------------------------------------
// Event contracts — the durable bus carries plain JSON, so the orchestrator
// request must be reconstructable from these fields alone on resume.
// ---------------------------------------------------------------------------

export const SUB_MD_SPAWN_EVENT = 'orchestrator/sub-md.spawn.requested';
export const ORCHESTRATOR_WAKE_EVENT = 'orchestrator/wake.requested';
export const ORCHESTRATOR_MONITOR_EVENT = 'orchestrator/monitor.armed';

export interface SubMdSpawnRequestedEvent {
  readonly name: typeof SUB_MD_SPAWN_EVENT;
  readonly data: {
    readonly subMdId: string;
    readonly parentThreadId: string;
    readonly childThreadId: string;
    readonly depth: number;
    readonly parentPersona: string;
    /** Persona + prompt + tools the child turn ingests. */
    readonly persona: string;
    readonly prompt: string;
    readonly tenantId: string | null;
    readonly scope: ScopeContext;
    readonly initialInput: Readonly<Record<string, unknown>>;
  };
}

export interface OrchestratorWakeRequestedEvent {
  readonly name: typeof ORCHESTRATOR_WAKE_EVENT;
  readonly data: {
    readonly threadId: string;
    readonly wakeAt: string;
    readonly reason: string;
    readonly resumeToken: string;
    readonly scope: ScopeContext;
  };
}

export interface OrchestratorMonitorArmedEvent {
  readonly name: typeof ORCHESTRATOR_MONITOR_EVENT;
  readonly data: {
    readonly watchId: string;
    readonly threadId: string;
    readonly predicate: string;
    readonly timeoutMs: number;
    readonly scope: ScopeContext;
  };
}

// ---------------------------------------------------------------------------
// Injected runner ports — the composition root binds these to the real
// kernel. Structural so this module stays kernel-agnostic.
// ---------------------------------------------------------------------------

/** Re-invokes the orchestrator for a freshly-spawned child sub-MD turn. */
export type ChildTurnRunner = (args: {
  readonly subMdId: string;
  readonly childThreadId: string;
  readonly parentThreadId: string;
  readonly depth: number;
  readonly persona: string;
  readonly prompt: string;
  readonly scope: ScopeContext;
  readonly initialInput: Readonly<Record<string, unknown>>;
}) => Promise<void>;

/** Re-invokes the orchestrator for a resumed (woken) thread. */
export type ResumeTurnRunner = (args: {
  readonly threadId: string;
  readonly reason: string;
  readonly resumeToken: string;
  readonly scope: ScopeContext;
}) => Promise<void>;

/**
 * Evaluates a monitor's predicate. Returns `true` when the watched
 * condition has fired (the durable function then re-invokes the
 * orchestrator and stops polling). The composition root binds this to a
 * real DB / event-bus check. MUST be cheap + idempotent — it runs once
 * per poll tick.
 */
export type MonitorChecker = (args: {
  readonly watchId: string;
  readonly predicate: string;
  readonly scope: ScopeContext;
}) => Promise<boolean>;

export interface DurableLoopActuatorsDeps {
  readonly composition: InngestComposition;
  /** Runs a child sub-MD turn (bound to `kernel.think()` by the caller). */
  readonly childTurnRunner: ChildTurnRunner;
  /** Resumes a woken thread (bound to `kernel.think()` by the caller). */
  readonly resumeTurnRunner: ResumeTurnRunner;
  /** Re-invokes the orchestrator when a monitor predicate fires. */
  readonly monitorResumeRunner: ResumeTurnRunner;
  /** Evaluates monitor predicates per poll tick. */
  readonly monitorChecker: MonitorChecker;
  /**
   * Poll interval (ms) the monitor function sleeps between predicate
   * checks. Default 5 minutes — bounded so a never-firing predicate
   * still expires at `timeoutMs` instead of polling forever.
   */
  readonly monitorPollIntervalMs?: number;
  readonly logger?: {
    info?(meta: object, msg: string): void;
    warn?(meta: object, msg: string): void;
    error?(meta: object, msg: string): void;
  };
  /**
   * In-process fallbacks used when the durable layer is disabled. The
   * caller passes the SAME runner callbacks so a degrade still runs the
   * real child / resume turn, just without crash-resilience. When
   * omitted, degrade records the intent + logs (never silently drops).
   */
  readonly inProcessFallback?: boolean;
}

/** Default poll cadence for the durable monitor function. */
export const DEFAULT_MONITOR_POLL_INTERVAL_MS = 5 * 60 * 1000;

export interface DurableLoopActuators {
  /** The `LoopActuators` bundle to thread into the registry dispatcher. */
  readonly actuators: LoopActuators;
  /**
   * The three registered Inngest function definitions. The api-gateway's
   * `/api/inngest` serve handler picks these up alongside the existing
   * task-agent + eviction-flow functions.
   */
  readonly definitions: ReadonlyArray<DurableFunctionDefinition>;
  /** True when the durable bus is enabled (events enqueue for real). */
  readonly durable: boolean;
}

/**
 * Compose the durable loop actuators + register their Inngest functions.
 *
 * Each port:
 *   1. When durable → enqueues an event (fire-and-forget producer) and
 *      returns the `durable` handle mode.
 *   2. When NOT durable → runs the in-process fallback (a detached
 *      background task for spawn; an immediate record for wake/monitor)
 *      and returns the degrade handle mode. The intent is recorded /
 *      logged — never silently dropped.
 *
 * Producers NEVER throw — a transport fault degrades to the fallback so
 * the parent orchestrator turn always stays alive.
 */
export function createDurableLoopActuators(
  deps: DurableLoopActuatorsDeps,
): DurableLoopActuators {
  const { composition } = deps;
  const durable = composition.enabled === true;
  const pollIntervalMs =
    deps.monitorPollIntervalMs ?? DEFAULT_MONITOR_POLL_INTERVAL_MS;

  const spawnDefinition = registerSpawnFunction(deps);
  const wakeDefinition = registerWakeFunction(deps);
  const monitorDefinition = registerMonitorFunction(deps, pollIntervalMs);

  const subAgentSpawner: SubAgentSpawner = {
    async spawn(spawn, ctx) {
      return spawnViaActuator(deps, durable, spawn, ctx);
    },
  };

  const scheduler: WakeScheduler = {
    async schedule(req) {
      return scheduleViaActuator(deps, durable, req);
    },
  };

  const monitorRegistry: MonitorRegistry = {
    async register(reg) {
      return armMonitorViaActuator(deps, durable, reg);
    },
  };

  return {
    actuators: { subAgentSpawner, scheduler, monitorRegistry },
    definitions: [spawnDefinition, wakeDefinition, monitorDefinition],
    durable,
  };
}

// ---------------------------------------------------------------------------
// Producer-side actuation (one helper per port).
// ---------------------------------------------------------------------------

async function spawnViaActuator(
  deps: DurableLoopActuatorsDeps,
  durable: boolean,
  spawn: SubMdSpawn,
  ctx: SubAgentSpawnContext,
): Promise<SubAgentSpawnHandle> {
  const childThreadId = `${ctx.parentThreadId}::sub::${spawn.subMdId}`;
  const tenantId = ctx.scope.kind === 'tenant' ? ctx.scope.tenantId : null;
  const persona = spawn.persona ?? ctx.parentPersona;
  const prompt = spawn.prompt ?? '';

  if (durable) {
    try {
      await deps.composition.client.send({
        name: SUB_MD_SPAWN_EVENT,
        data: {
          subMdId: spawn.subMdId,
          parentThreadId: ctx.parentThreadId,
          childThreadId,
          depth: ctx.depth,
          parentPersona: ctx.parentPersona,
          persona,
          prompt,
          tenantId,
          scope: ctx.scope,
          initialInput: spawn.initialInput,
        },
      });
      return { handoffToken: `durable:${childThreadId}`, mode: 'durable' };
    } catch (err) {
      deps.logger?.warn?.(
        { err: errMessage(err), subMdId: spawn.subMdId },
        'durable-loop-actuators: spawn enqueue failed; falling back in-process',
      );
      // fall through to in-process
    }
  }

  // In-process fire-and-forget fallback. We do NOT await the child turn —
  // the parent must keep looping. A child failure is logged, not thrown.
  if (deps.inProcessFallback !== false) {
    runChildInBackground(deps, {
      subMdId: spawn.subMdId,
      childThreadId,
      parentThreadId: ctx.parentThreadId,
      depth: ctx.depth,
      persona,
      prompt,
      scope: ctx.scope,
      initialInput: spawn.initialInput,
    });
    return { handoffToken: `inproc:${childThreadId}`, mode: 'in-process' };
  }

  deps.logger?.warn?.(
    { subMdId: spawn.subMdId, childThreadId },
    'durable-loop-actuators: spawn recorded (no durable infra, fallback disabled)',
  );
  return { handoffToken: `recorded:${childThreadId}`, mode: 'in-process' };
}

async function scheduleViaActuator(
  deps: DurableLoopActuatorsDeps,
  durable: boolean,
  req: WakeRequest,
): Promise<WakeScheduleHandle> {
  if (durable) {
    try {
      await deps.composition.client.send({
        name: ORCHESTRATOR_WAKE_EVENT,
        data: {
          threadId: req.threadId,
          wakeAt: req.wakeAt,
          reason: req.reason,
          resumeToken: req.resumeToken,
          scope: req.scope,
        },
      });
      return { resumeToken: req.resumeToken, mode: 'durable' };
    } catch (err) {
      deps.logger?.warn?.(
        { err: errMessage(err), threadId: req.threadId },
        'durable-loop-actuators: wake enqueue failed; degraded to recorded',
      );
    }
  }
  // Degrade: the wake intent is recorded via the log so it is not lost.
  // (A non-durable runtime cannot safely suspend-and-resume, so we do not
  // fire a real timer here — recording keeps the contract honest.)
  deps.logger?.warn?.(
    { threadId: req.threadId, wakeAt: req.wakeAt, resumeToken: req.resumeToken },
    'durable-loop-actuators: wake recorded (no durable scheduler)',
  );
  return { resumeToken: req.resumeToken, mode: 'recorded' };
}

async function armMonitorViaActuator(
  deps: DurableLoopActuatorsDeps,
  durable: boolean,
  reg: MonitorRegistration,
): Promise<MonitorRegisterHandle> {
  if (durable) {
    try {
      await deps.composition.client.send({
        name: ORCHESTRATOR_MONITOR_EVENT,
        data: {
          watchId: reg.watchId,
          threadId: reg.threadId,
          predicate: reg.predicate,
          timeoutMs: reg.timeoutMs,
          scope: reg.scope,
        },
      });
      return { watchId: reg.watchId, mode: 'registered' };
    } catch (err) {
      deps.logger?.warn?.(
        { err: errMessage(err), watchId: reg.watchId },
        'durable-loop-actuators: monitor enqueue failed; degraded to recorded',
      );
    }
  }
  deps.logger?.warn?.(
    { watchId: reg.watchId, threadId: reg.threadId, predicate: reg.predicate },
    'durable-loop-actuators: monitor recorded (no durable registry)',
  );
  return { watchId: reg.watchId, mode: 'recorded' };
}

/**
 * Detached in-process child turn. We deliberately do NOT await the
 * promise at the call site (fire-and-forget); a rejection is caught here
 * so it never becomes an unhandled rejection that crashes the host.
 */
function runChildInBackground(
  deps: DurableLoopActuatorsDeps,
  args: Parameters<ChildTurnRunner>[0],
): void {
  void Promise.resolve()
    .then(() => deps.childTurnRunner(args))
    .catch((err) => {
      deps.logger?.error?.(
        { err: errMessage(err), subMdId: args.subMdId },
        'durable-loop-actuators: in-process child turn failed',
      );
    });
}

// ---------------------------------------------------------------------------
// Consumer-side durable function registration (one per event).
// ---------------------------------------------------------------------------

function registerSpawnFunction(
  deps: DurableLoopActuatorsDeps,
): DurableFunctionDefinition {
  const { composition } = deps;
  return composition.client.createFunction({
    id: `${composition.config.appId}.orchestrator.sub-md-spawn`,
    name: 'orchestrator sub-MD spawn (durable, fire-and-forget)',
    trigger: { event: SUB_MD_SPAWN_EVENT },
    handler: async (ctx: DurableFunctionContext) => {
      const event = ctx.event as SubMdSpawnRequestedEvent;
      const d = event.data;
      const stepKey = `${d.subMdId}:${d.childThreadId}`;
      await ctx.step.run(`run-child-turn:${stepKey}`, () =>
        deps.childTurnRunner({
          subMdId: d.subMdId,
          childThreadId: d.childThreadId,
          parentThreadId: d.parentThreadId,
          depth: d.depth,
          persona: d.persona,
          prompt: d.prompt,
          scope: d.scope,
          initialInput: d.initialInput,
        }),
      );
      return { subMdId: d.subMdId, childThreadId: d.childThreadId };
    },
  });
}

function registerWakeFunction(
  deps: DurableLoopActuatorsDeps,
): DurableFunctionDefinition {
  const { composition } = deps;
  return composition.client.createFunction({
    id: `${composition.config.appId}.orchestrator.wake`,
    name: 'orchestrator wake (durable suspend/resume)',
    trigger: { event: ORCHESTRATOR_WAKE_EVENT },
    handler: async (ctx: DurableFunctionContext) => {
      const event = ctx.event as OrchestratorWakeRequestedEvent;
      const d = event.data;
      const stepKey = `${d.threadId}:${d.resumeToken}`;
      // Suspend until the wake time — survives any number of restarts.
      if (ctx.step.sleepUntil) {
        await ctx.step.sleepUntil(`sleep-until-wake:${stepKey}`, d.wakeAt);
      }
      await ctx.step.run(`resume-turn:${stepKey}`, () =>
        deps.resumeTurnRunner({
          threadId: d.threadId,
          reason: d.reason,
          resumeToken: d.resumeToken,
          scope: d.scope,
        }),
      );
      return { threadId: d.threadId, resumeToken: d.resumeToken };
    },
  });
}

function registerMonitorFunction(
  deps: DurableLoopActuatorsDeps,
  pollIntervalMs: number,
): DurableFunctionDefinition {
  const { composition } = deps;
  return composition.client.createFunction({
    id: `${composition.config.appId}.orchestrator.monitor`,
    name: 'orchestrator monitor (durable bounded poll)',
    trigger: { event: ORCHESTRATOR_MONITOR_EVENT },
    handler: async (ctx: DurableFunctionContext) => {
      const event = ctx.event as OrchestratorMonitorArmedEvent;
      const d = event.data;
      return runMonitorPollLoop(deps, ctx.step, d, pollIntervalMs);
    },
  });
}

/**
 * Bounded poll loop: sleep → check predicate → re-invoke on fire; stop
 * when the predicate fires OR the cumulative wait exceeds `timeoutMs`.
 * Every sleep + check + resume is a `step.run` so a crash resumes from
 * the last completed tick rather than restarting the watch.
 */
async function runMonitorPollLoop(
  deps: DurableLoopActuatorsDeps,
  step: DurableStepLike,
  d: OrchestratorMonitorArmedEvent['data'],
  pollIntervalMs: number,
): Promise<{ readonly watchId: string; readonly outcome: 'fired' | 'expired' }> {
  const stepKey = `${d.watchId}:${d.threadId}`;
  const maxTicks = Math.max(1, Math.ceil(d.timeoutMs / pollIntervalMs));
  for (let tick = 0; tick < maxTicks; tick += 1) {
    if (step.sleepUntil) {
      const wakeAt = new Date(Date.now() + pollIntervalMs).toISOString();
      await step.sleepUntil(`monitor-sleep:${stepKey}:${tick}`, wakeAt);
    }
    const fired = await step.run(`monitor-check:${stepKey}:${tick}`, () =>
      deps.monitorChecker({
        watchId: d.watchId,
        predicate: d.predicate,
        scope: d.scope,
      }),
    );
    if (fired) {
      await step.run(`monitor-resume:${stepKey}:${tick}`, () =>
        deps.monitorResumeRunner({
          threadId: d.threadId,
          reason: `monitor:${d.predicate}`,
          resumeToken: `monitor:${d.watchId}`,
          scope: d.scope,
        }),
      );
      return { watchId: d.watchId, outcome: 'fired' };
    }
  }
  deps.logger?.info?.(
    { watchId: d.watchId, threadId: d.threadId, predicate: d.predicate },
    'durable-loop-actuators: monitor expired without firing',
  );
  return { watchId: d.watchId, outcome: 'expired' };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
