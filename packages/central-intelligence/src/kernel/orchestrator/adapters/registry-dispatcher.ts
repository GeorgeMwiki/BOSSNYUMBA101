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
 *   - `schedule_wake`    → `wake_ack` keyed by the resume token / wake-at.
 *   - `monitor`          → `monitor_ack` keyed by the watch id.
 *   - `spawn_sub_md`     → `spawn_ack`. The full child-orchestrator fork
 *                          lives above the kernel (Phase F worktree wire);
 *                          here we acknowledge the handoff so the parent
 *                          loop's subagent lifecycle hooks fire. Marked
 *                          `background` when the spawn is fire-and-forget.
 *
 * Discipline preserved (NOT bypassed):
 *   - zod input/output gates  → enforced by `registry.runTool`.
 *   - audit-trail emission    → registry `auditSink` (deterministic row)
 *                               + the orchestrator's PostToolUse
 *                               audit-emission hook (dispatch-level row).
 *   - four-eye / killswitch / denylist / rate / cost → enforced by the
 *                               orchestrator's PreToolUse hook chain
 *                               BEFORE this dispatcher is ever called.
 *
 * The dispatcher NEVER throws: a missing tool, an invalid input, or an
 * executor failure all collapse to a `tool_error` DispatchResult so the
 * main loop can fold the error back into the next router call and keep
 * the turn alive (graceful degrade, no hard blocker).
 */

import type { HookContext } from '../hook-chain.js';
import type { Decision, DispatchResult } from '../decision.js';
import { isBackgroundSpawn } from '../decision.js';
import type { Dispatcher } from '../main-loop.js';
import type { BrainToolRegistry, BrainToolOutcome } from '../../tool-spec.js';

export interface RegistryDispatcherConfig {
  /** Optional clock for latency measurement. Defaults to `Date.now`. */
  readonly clock?: () => number;
  /** Optional structured logger for unexpected failures. */
  readonly logger?: {
    warn(msg: string, meta?: Record<string, unknown>): void;
  };
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

  return {
    async dispatch(
      decision: Decision,
      _ctx: HookContext,
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
          return {
            kind: 'wake_ack',
            resumeToken: decision.wake.resumeToken ?? decision.wake.wakeAt,
          };
        case 'monitor':
          return { kind: 'monitor_ack', watchId: decision.watch.watchId };
        case 'spawn_sub_md':
          return {
            kind: 'spawn_ack',
            subMdId: decision.spawn.subMdId,
            handoffToken: `handoff:${decision.spawn.subMdId}`,
            ...(isBackgroundSpawn(decision.spawn) ? { background: true } : {}),
          };
      }
    },
  };
}
