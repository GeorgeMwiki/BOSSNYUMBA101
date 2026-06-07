/**
 * Registry-backed `Dispatcher` — the orchestrator's actuator.
 *
 * The main loop applies the 9-hook PreToolUse / PostToolUse / Stop chain
 * (pii-scrub → permission → four-eye → tool-denylist → rate-limit →
 * cost-circuit → sandbox-divert → audit-emission → ledger-seal) AROUND
 * each dispatch. THIS dispatcher does the actual tool execution between
 * PreToolUse and PostToolUse, mirroring the disciplined path the legacy
 * 13-step pipeline already uses for deterministic tools:
 *
 *   - `tool_call`        → `registry.runTool(name, input)`. The registry
 *                          itself enforces the zod input gate, runs the
 *                          executor, validates the output against the
 *                          zod output schema, and lays down an audit row
 *                          via its injected `auditSink`. We translate the
 *                          `BrainToolOutcome` onto a `DispatchResult`.
 *   - `respond_to_owner`
 *     / `final`          → terminal `response` result carrying the text.
 *   - `schedule_wake`    → REAL durable wake via the injected
 *                          `WakeScheduler` (pause + resume later); when no
 *                          scheduler is wired the intent is recorded +
 *                          logged and a `wake_ack` is still returned
 *                          (graceful degrade — never a silent drop).
 *   - `monitor`          → REAL watch registration via the injected
 *                          `MonitorRegistry` (condition → re-invoke); when
 *                          absent, the intent is recorded + logged and a
 *                          `monitor_ack` is still returned.
 *   - `spawn_sub_md`     → REAL child Mr. Mwikila fork via the injected
 *                          `SubAgentSpawner` (durable job → child
 *                          `kernel.think()` turn, fire-and-forget). A hard
 *                          recursion DEPTH CAP refuses a spawn that would
 *                          nest past `maxSpawnDepth`. When no spawner is
 *                          wired the spawn degrades to a logged `spawn_ack`.
 *                          Marked `background` when fire-and-forget.
 *
 * Discipline preserved (NOT bypassed):
 *   - zod input/output gates  → enforced by `registry.runTool`.
 *   - audit-trail emission    → registry `auditSink` (deterministic row)
 *                               + the orchestrator's PostToolUse
 *                               audit-emission hook (dispatch-level row).
 *   - four-eye / killswitch / denylist / rate / cost → enforced by the
 *                               orchestrator's PreToolUse hook chain
 *                               BEFORE this dispatcher is ever called.
 *   - recursion / cost        → spawn depth cap (fail-closed) + the
 *                               main-loop's per-turn budget; the spawner's
 *                               own sub-budget envelope (`spawn.budget`).
 *
 * The dispatcher NEVER throws: a missing tool, an invalid input, an
 * executor failure, OR a loop-actuator outage all collapse to a graceful
 * DispatchResult (`tool_error`, or the ACK for the actuated variants) so
 * the main loop can keep the turn alive (graceful degrade, no hard
 * blocker, no silent success).
 */

import type { HookContext } from '../hook-chain.js';
import type { Decision, DispatchResult } from '../decision.js';
import { isBackgroundSpawn } from '../decision.js';
import type { Dispatcher } from '../main-loop.js';
import type { BrainToolRegistry, BrainToolOutcome } from '../../tool-spec.js';
import {
  DEFAULT_MAX_SPAWN_DEPTH,
  type LoopActuators,
  type SubAgentSpawnHandle,
  type WakeScheduleHandle,
  type MonitorRegisterHandle,
} from './loop-actuators.js';

export interface RegistryDispatcherConfig {
  /** Optional clock for latency measurement. Defaults to `Date.now`. */
  readonly clock?: () => number;
  /** Optional structured logger for unexpected failures. */
  readonly logger?: {
    warn(msg: string, meta?: Record<string, unknown>): void;
    info?(msg: string, meta?: Record<string, unknown>): void;
  };
  /**
   * Loop actuators — the three ports that make the agentic-loop Decision
   * variants (`spawn_sub_md`, `schedule_wake`, `monitor`) execute for
   * REAL. When absent (or a specific port within is null) the matching
   * variant degrades gracefully: the intent is recorded + logged and the
   * ACK the main loop expects is still returned. NEVER a silent drop.
   */
  readonly loopActuators?: LoopActuators;
}

/**
 * Translate a deterministic `BrainToolOutcome` onto the orchestrator's
 * `DispatchResult`. Token + cost fields are zero — the registry runs
 * deterministic executors (DB reads, pure functions), not billed LLM
 * calls, so there is no token spend to attribute to a tool dispatch.
 */
function outcomeToDispatchResult(
  callId: string,
  outcome: BrainToolOutcome<unknown>,
  latencyMs: number,
): DispatchResult {
  switch (outcome.kind) {
    case 'ok':
      return {
        kind: 'tool_ok',
        callId,
        output: outcome.output,
        latencyMs: outcome.durationMs ?? latencyMs,
        tokensIn: 0,
        tokensOut: 0,
        usdCost: 0,
      };
    case 'not-found':
      return {
        kind: 'tool_error',
        callId,
        message: `tool not found: ${outcome.name}`,
        latencyMs,
      };
    case 'input-invalid':
      return {
        kind: 'tool_error',
        callId,
        message: `input-invalid: ${outcome.issue}`,
        latencyMs,
      };
    case 'output-invalid':
      return {
        kind: 'tool_error',
        callId,
        message: `output-invalid: ${outcome.issue}`,
        latencyMs,
      };
    case 'executor-failed':
      return {
        kind: 'tool_error',
        callId,
        message: `executor-failed: ${outcome.message}`,
        latencyMs,
      };
  }
}

/**
 * Build a `Dispatcher` that actuates Decisions against a seeded
 * `BrainToolRegistry`. The registry is the SAME one the kernel composes
 * (the 5 PM seed tools + any merged HQ tools), so the orchestrator and
 * the legacy pipeline execute tools through one catalog.
 */
export function createRegistryDispatcher(
  registry: BrainToolRegistry,
  config: RegistryDispatcherConfig = {},
): Dispatcher {
  const clock = config.clock ?? Date.now;

  async function dispatchToolCall(decision: Decision): Promise<DispatchResult> {
    if (decision.kind !== 'tool_call') {
      // Unreachable — guarded by the caller. Kept for exhaustiveness.
      return {
        kind: 'tool_error',
        callId: 'unknown',
        message: 'dispatchToolCall received a non-tool_call decision',
        latencyMs: 0,
      };
    }
    const { call } = decision;
    const started = clock();
    try {
      const outcome = await registry.runTool(call.toolName, call.input);
      return outcomeToDispatchResult(
        call.callId,
        outcome,
        Math.max(0, clock() - started),
      );
    } catch (err) {
      // The registry already catches executor throws and returns an
      // `executor-failed` outcome; this catch only fires on an
      // unexpected registry-internal fault. Never throw out of dispatch.
      const message = err instanceof Error ? err.message : String(err);
      config.logger?.warn('registry-dispatcher: unexpected runTool fault', {
        toolName: call.toolName,
        reason: message,
      });
      return {
        kind: 'tool_error',
        callId: call.callId,
        message: `dispatch-fault: ${message}`,
        latencyMs: Math.max(0, clock() - started),
      };
    }
  }

  const actuators = config.loopActuators;
  const maxSpawnDepth = actuators?.maxSpawnDepth ?? DEFAULT_MAX_SPAWN_DEPTH;
  const currentDepth = actuators?.currentDepth ?? 0;

  // ───────────────────────────────────────────────────────────────────
  // schedule_wake — durable pause/resume. Real when a scheduler is wired;
  // graceful degrade (record + log) otherwise. ALWAYS returns wake_ack.
  // ───────────────────────────────────────────────────────────────────
  async function dispatchScheduleWake(
    decision: Extract<Decision, { kind: 'schedule_wake' }>,
    ctx: HookContext,
  ): Promise<DispatchResult> {
    const resumeToken = decision.wake.resumeToken ?? decision.wake.wakeAt;
    const scheduler = actuators?.scheduler;
    if (!scheduler) {
      config.logger?.warn(
        'registry-dispatcher: schedule_wake degraded (no scheduler wired)',
        { threadId: ctx.threadId, wakeAt: decision.wake.wakeAt },
      );
      return { kind: 'wake_ack', resumeToken };
    }
    let handle: WakeScheduleHandle;
    try {
      handle = await scheduler.schedule({
        threadId: ctx.threadId,
        wakeAt: decision.wake.wakeAt,
        reason: decision.wake.reason,
        scope: ctx.scope,
        resumeToken,
      });
    } catch (err) {
      // Never let a scheduler fault crash the turn — degrade honestly.
      config.logger?.warn(
        'registry-dispatcher: schedule_wake scheduler fault; degraded',
        { threadId: ctx.threadId, reason: errMessage(err) },
      );
      return { kind: 'wake_ack', resumeToken };
    }
    config.logger?.info?.('registry-dispatcher: schedule_wake actuated', {
      threadId: ctx.threadId,
      wakeAt: decision.wake.wakeAt,
      mode: handle.mode,
    });
    return { kind: 'wake_ack', resumeToken: handle.resumeToken };
  }

  // ───────────────────────────────────────────────────────────────────
  // monitor — register a watch (condition → re-invoke) and yield. Real
  // when a registry is wired; graceful degrade otherwise. ALWAYS returns
  // monitor_ack.
  // ───────────────────────────────────────────────────────────────────
  async function dispatchMonitor(
    decision: Extract<Decision, { kind: 'monitor' }>,
    ctx: HookContext,
  ): Promise<DispatchResult> {
    const registry = actuators?.monitorRegistry;
    if (!registry) {
      config.logger?.warn(
        'registry-dispatcher: monitor degraded (no monitor registry wired)',
        { threadId: ctx.threadId, watchId: decision.watch.watchId },
      );
      return { kind: 'monitor_ack', watchId: decision.watch.watchId };
    }
    let handle: MonitorRegisterHandle;
    try {
      handle = await registry.register({
        watchId: decision.watch.watchId,
        threadId: ctx.threadId,
        predicate: decision.watch.predicate,
        timeoutMs: decision.watch.timeoutMs,
        scope: ctx.scope,
      });
    } catch (err) {
      config.logger?.warn(
        'registry-dispatcher: monitor registry fault; degraded',
        { threadId: ctx.threadId, reason: errMessage(err) },
      );
      return { kind: 'monitor_ack', watchId: decision.watch.watchId };
    }
    config.logger?.info?.('registry-dispatcher: monitor actuated', {
      threadId: ctx.threadId,
      watchId: handle.watchId,
      mode: handle.mode,
    });
    return { kind: 'monitor_ack', watchId: handle.watchId };
  }

  // ───────────────────────────────────────────────────────────────────
  // spawn_sub_md — fork a child Mr. Mwikila on the sub-task. Enforces a
  // hard recursion DEPTH CAP before invoking the spawner. Real when a
  // spawner is wired; graceful degrade otherwise. ALWAYS returns
  // spawn_ack so the parent's subagent lifecycle hooks fire and the loop
  // keeps going (fire-and-forget).
  // ───────────────────────────────────────────────────────────────────
  async function dispatchSpawnSubMd(
    decision: Extract<Decision, { kind: 'spawn_sub_md' }>,
    ctx: HookContext,
  ): Promise<DispatchResult> {
    const { spawn } = decision;
    const background = isBackgroundSpawn(spawn);
    const ackBase = {
      kind: 'spawn_ack' as const,
      subMdId: spawn.subMdId,
      ...(background ? { background: true } : {}),
    };
    // The child this spawn would create runs one level deeper than the
    // current turn. Refuse fail-closed when that exceeds the cap so a
    // self-spawning loop can never exhaust the host. The parent STILL
    // continues (we return an ack), it just gets no child.
    const childDepth = currentDepth + 1;
    if (childDepth > maxSpawnDepth) {
      config.logger?.warn(
        'registry-dispatcher: spawn_sub_md refused (recursion depth cap)',
        {
          threadId: ctx.threadId,
          subMdId: spawn.subMdId,
          childDepth,
          maxSpawnDepth,
        },
      );
      return { ...ackBase, handoffToken: `refused-depth:${spawn.subMdId}` };
    }
    const spawner = actuators?.subAgentSpawner;
    if (!spawner) {
      config.logger?.warn(
        'registry-dispatcher: spawn_sub_md degraded (no spawner wired)',
        { threadId: ctx.threadId, subMdId: spawn.subMdId, childDepth },
      );
      return { ...ackBase, handoffToken: `handoff:${spawn.subMdId}` };
    }
    let handle: SubAgentSpawnHandle;
    try {
      handle = await spawner.spawn(spawn, {
        parentThreadId: ctx.threadId,
        scope: spawn.scope ?? ctx.scope,
        depth: childDepth,
        parentPersona: ctx.scope.kind === 'tenant'
          ? ctx.scope.personaId
          : '_platform',
      });
    } catch (err) {
      // A spawner fault must not crash the parent turn — degrade.
      config.logger?.warn(
        'registry-dispatcher: spawn_sub_md spawner fault; degraded',
        { threadId: ctx.threadId, subMdId: spawn.subMdId, reason: errMessage(err) },
      );
      return { ...ackBase, handoffToken: `handoff:${spawn.subMdId}` };
    }
    config.logger?.info?.('registry-dispatcher: spawn_sub_md actuated', {
      threadId: ctx.threadId,
      subMdId: spawn.subMdId,
      childDepth,
      mode: handle.mode,
    });
    return { ...ackBase, handoffToken: handle.handoffToken };
  }

  return {
    async dispatch(
      decision: Decision,
      ctx: HookContext,
    ): Promise<DispatchResult> {
      switch (decision.kind) {
        case 'tool_call':
          return dispatchToolCall(decision);
        case 'respond_to_owner':
        case 'final':
          return {
            kind: 'response',
            text: decision.text,
            tokensIn: 0,
            tokensOut: 0,
            usdCost: 0,
          };
        case 'schedule_wake':
          return dispatchScheduleWake(decision, ctx);
        case 'monitor':
          return dispatchMonitor(decision, ctx);
        case 'spawn_sub_md':
          return dispatchSpawnSubMd(decision, ctx);
      }
    },
  };
}

/** Normalise a thrown value to a string message without leaking stacks. */
function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
