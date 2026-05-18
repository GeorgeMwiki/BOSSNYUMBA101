/**
 * Decision ADT — the closed shape the orchestrator's LLM router returns at
 * each tick of the main loop. Mirrors the Claude-Code-level
 * "what does the model want to do next?" surface.
 *
 * Six terminal/transitional variants:
 *   - `respond_to_owner`   final natural-language reply to the caller
 *   - `tool_call`          invoke a registered BrainTool / HQ tool
 *   - `spawn_sub_md`       fork a sub-MD (maintenance-dispatch, complaint-
 *                          triage, etc.) with a scoped sub-budget
 *   - `schedule_wake`      ask the wake-loop to revive this thread later
 *   - `monitor`            install a watcher (event predicate) and yield
 *   - `final`              graceful close — plan reached its goal
 *
 * Pure data — no executor coupling. The orchestrator's `dispatch()` is the
 * only thing that knows how to actuate each variant.
 */

import type { ScopeContext } from '../../types.js';

// ─────────────────────────────────────────────────────────────────────
// Tool-call payload — orchestrator-side, intentionally distinct from
// the sensor-emitted `SensorCallResult.toolCalls` shape so the
// orchestrator can carry richer routing context (cost ceiling, four-eye
// override, sandbox preference) the sensor adapter does not see.
// ─────────────────────────────────────────────────────────────────────

export interface DecisionToolCall {
  readonly toolName: string;
  readonly input: Readonly<Record<string, unknown>>;
  /** Caller-supplied unique id so dispatch + hook layers can correlate. */
  readonly callId: string;
  /** Optional estimate so the cost-circuit hook can short-circuit early. */
  readonly estimatedCostUsd?: number;
}

// ─────────────────────────────────────────────────────────────────────
// Sub-MD spawn payload — handoff descriptor for the autonomy-governance
// layer. The orchestrator does NOT itself execute the sub-MD; it emits a
// dispatch envelope the composition root forwards to the right runtime
// (maintenance-dispatch, complaint-triage, etc.).
// ─────────────────────────────────────────────────────────────────────

export interface SubMdSpawn {
  readonly subMdId: string;
  readonly scope: ScopeContext;
  readonly initialInput: Readonly<Record<string, unknown>>;
  /** Caller-supplied SLO id so the parent can read the sub-MD's bench. */
  readonly sloId?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Schedule-wake payload — caller-supplied wake hint. Implementation
// lives in the wake-loop above the kernel; the orchestrator only emits.
// ─────────────────────────────────────────────────────────────────────

export interface ScheduleWake {
  readonly wakeAt: string;
  readonly reason: string;
  /** Optional event id the wake handler should pass back into think(). */
  readonly resumeToken?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Monitor payload — a coarse predicate description. The composition
// root wires the predicate to a real event bus.
// ─────────────────────────────────────────────────────────────────────

export interface MonitorWatch {
  readonly watchId: string;
  readonly predicate: string;
  readonly timeoutMs: number;
}

// ─────────────────────────────────────────────────────────────────────
// Decision union — closed so pattern-matchers exhaust every variant.
// ─────────────────────────────────────────────────────────────────────

export type Decision =
  | {
      readonly kind: 'respond_to_owner';
      readonly text: string;
      readonly citations?: ReadonlyArray<string>;
    }
  | {
      readonly kind: 'tool_call';
      readonly call: DecisionToolCall;
    }
  | {
      readonly kind: 'spawn_sub_md';
      readonly spawn: SubMdSpawn;
    }
  | {
      readonly kind: 'schedule_wake';
      readonly wake: ScheduleWake;
    }
  | {
      readonly kind: 'monitor';
      readonly watch: MonitorWatch;
    }
  | {
      readonly kind: 'final';
      readonly text: string;
    };

// ─────────────────────────────────────────────────────────────────────
// Dispatch result — emitted by the orchestrator's dispatch() for each
// Decision. The main loop consumes this to advance the plan and update
// the budget.
// ─────────────────────────────────────────────────────────────────────

export type DispatchResult =
  | {
      readonly kind: 'tool_ok';
      readonly callId: string;
      readonly output: unknown;
      readonly latencyMs: number;
      readonly tokensIn: number;
      readonly tokensOut: number;
      readonly usdCost: number;
    }
  | {
      readonly kind: 'tool_error';
      readonly callId: string;
      readonly message: string;
      readonly latencyMs: number;
    }
  | {
      readonly kind: 'response';
      readonly text: string;
      readonly tokensIn: number;
      readonly tokensOut: number;
      readonly usdCost: number;
    }
  | {
      readonly kind: 'spawn_ack';
      readonly subMdId: string;
      readonly handoffToken: string;
    }
  | {
      readonly kind: 'wake_ack';
      readonly resumeToken: string;
    }
  | {
      readonly kind: 'monitor_ack';
      readonly watchId: string;
    };
