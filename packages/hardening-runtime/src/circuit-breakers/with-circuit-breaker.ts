/**
 * withCircuitBreaker — guarded execution of an agent-loop step driver.
 *
 * L3 §8 #3 — cost + step circuit-breakers on every agent loop.
 *
 * Contract:
 *   - Caller supplies a `step` function returning `{ done, costDelta,
 *     toolCallsDelta }`. The harness sums deltas after each call.
 *   - On every step (BEFORE invocation), we test each cap. Tripping a
 *     cap stops the loop and emits a `circuit-breaker-tripped` event
 *     via the supplied `onTripped` callback.
 *   - On clean exit (step returns `done: true`), we return the result
 *     with current counters.
 *
 * The harness is wire-agnostic: no LLM calls, no IO, just bookkeeping.
 * The wire-side adapter (services/ai-orchestrator) wraps a real loop.
 */

import type {
  CircuitBreakerCap,
  CircuitBreakerCaps,
  CircuitBreakerCounters,
  CircuitBreakerResult,
  CircuitBreakerTrippedEvent,
} from '../types.js';
import { mergeCaps } from './caps.js';

/**
 * Per-step result returned by the step function.
 *
 * `done` — set true when the loop has produced its final result.
 * `value` — the final value when `done` is true.
 * `costDeltaUsdCents` — incremental cost incurred by this step.
 * `toolCallsDelta` — incremental number of tool invocations.
 */
export interface StepResult<T> {
  readonly done: boolean;
  readonly value?: T;
  readonly costDeltaUsdCents?: number;
  readonly toolCallsDelta?: number;
}

export interface WithCircuitBreakerOptions {
  readonly caps?: Partial<CircuitBreakerCaps>;
  readonly tenantId?: string | null;
  readonly subMd?: string | null;
  readonly now?: () => number;
  readonly onTripped?: (e: CircuitBreakerTrippedEvent) => void;
}

/**
 * Wrap a step-driver in caps. The driver is invoked repeatedly until
 * either it returns `{ done: true }` or a cap trips.
 *
 * Returns:
 *   - `{ ok: true, value, counters }` on clean completion.
 *   - `{ ok: false, trippedCap, counters, reason }` on cap trip.
 *
 * NEVER throws on cap trip — callers handle the result. Throws only if
 * the step driver itself throws (which the caller can choose to treat as
 * a transient error and retry, or as terminal).
 */
export async function withCircuitBreaker<T>(
  step: () => Promise<StepResult<T>>,
  options: WithCircuitBreakerOptions = {},
): Promise<CircuitBreakerResult<T>> {
  const caps = mergeCaps(options.caps);
  const clock = options.now ?? Date.now;
  const startedAt = clock();

  let counters: CircuitBreakerCounters = {
    steps: 0,
    costUsdCents: 0,
    wallTimeMs: 0,
    toolCalls: 0,
  };

  // Defensive max iterations — prevents an infinite-loop in `step` from
  // freezing the runtime even if the step driver is buggy and never returns
  // done. Bounded by maxSteps * 2 (so the cap test still trips first).
  const safetyMax = caps.maxSteps * 2 + 10;
  for (let iter = 0; iter < safetyMax; iter += 1) {
    // Cap test BEFORE the step. The wall-clock cap is tested with a fresh
    // clock read so long-running steps still trip.
    const wallNow = clock() - startedAt;
    counters = freezeCounters({
      steps: counters.steps,
      costUsdCents: counters.costUsdCents,
      wallTimeMs: wallNow,
      toolCalls: counters.toolCalls,
    });

    const tripped = findTrippedCap(caps, counters);
    if (tripped !== null) {
      emitTrippedEvent(tripped, caps, counters, options, clock);
      return Object.freeze({
        ok: false,
        trippedCap: tripped,
        counters,
        reason: trippedReason(tripped, caps, counters),
      });
    }

    // Step.
    const result = await step();

    counters = freezeCounters({
      steps: counters.steps + 1,
      costUsdCents: counters.costUsdCents + (result.costDeltaUsdCents ?? 0),
      wallTimeMs: clock() - startedAt,
      toolCalls: counters.toolCalls + (result.toolCallsDelta ?? 0),
    });

    if (result.done) {
      // Final cap test AFTER the step — ensures the last-step cost
      // overage is still caught.
      const trippedAfter = findTrippedCap(caps, counters);
      if (trippedAfter !== null) {
        emitTrippedEvent(trippedAfter, caps, counters, options, clock);
        return Object.freeze({
          ok: false,
          trippedCap: trippedAfter,
          counters,
          reason: trippedReason(trippedAfter, caps, counters),
        });
      }
      // value may legitimately be undefined for void-returning loops.
      return Object.freeze({
        ok: true,
        value: result.value as T,
        counters,
      });
    }
  }

  // Safety-max exit — fall through to a synthetic max-steps trip.
  const fallthroughTrip: CircuitBreakerCap = 'max-steps';
  emitTrippedEvent(fallthroughTrip, caps, counters, options, clock);
  return Object.freeze({
    ok: false,
    trippedCap: fallthroughTrip,
    counters,
    reason:
      'Safety iteration limit reached; step driver did not return done. ' +
      'This indicates a buggy step driver.',
  });
}

function freezeCounters(c: CircuitBreakerCounters): CircuitBreakerCounters {
  return Object.freeze({ ...c });
}

function findTrippedCap(
  caps: CircuitBreakerCaps,
  counters: CircuitBreakerCounters,
): CircuitBreakerCap | null {
  if (counters.steps > caps.maxSteps) return 'max-steps';
  if (counters.costUsdCents > caps.maxCostUsdCents) return 'max-cost';
  if (counters.wallTimeMs > caps.maxWallTimeMs) return 'max-wall-time';
  if (counters.toolCalls > caps.maxToolCalls) return 'max-tool-calls';
  return null;
}

function trippedReason(
  cap: CircuitBreakerCap,
  caps: CircuitBreakerCaps,
  c: CircuitBreakerCounters,
): string {
  switch (cap) {
    case 'max-steps':
      return `Step cap exceeded: ${c.steps} > ${caps.maxSteps}`;
    case 'max-cost':
      return `Cost cap exceeded: ${c.costUsdCents}c > ${caps.maxCostUsdCents}c`;
    case 'max-wall-time':
      return `Wall-time cap exceeded: ${c.wallTimeMs}ms > ${caps.maxWallTimeMs}ms`;
    case 'max-tool-calls':
      return `Tool-call cap exceeded: ${c.toolCalls} > ${caps.maxToolCalls}`;
  }
}

function severityFor(cap: CircuitBreakerCap): 'low' | 'medium' | 'high' {
  switch (cap) {
    case 'max-cost':
      return 'high';
    case 'max-tool-calls':
      return 'high';
    case 'max-steps':
      return 'medium';
    case 'max-wall-time':
      return 'low';
  }
}

function emitTrippedEvent(
  cap: CircuitBreakerCap,
  caps: CircuitBreakerCaps,
  counters: CircuitBreakerCounters,
  options: WithCircuitBreakerOptions,
  clock: () => number,
): void {
  const handler = options.onTripped;
  if (!handler) return;
  const event: CircuitBreakerTrippedEvent = Object.freeze({
    type: 'circuit-breaker-tripped',
    tenantId: options.tenantId ?? null,
    subMd: options.subMd ?? null,
    trippedCap: cap,
    counters,
    caps,
    severity: severityFor(cap),
    reason: trippedReason(cap, caps, counters),
    timestamp: new Date(clock()).toISOString(),
  });
  try {
    handler(event);
  } catch {
    // Swallowed — we never let a telemetry handler poison the circuit
    // breaker's primary contract (return a result, never throw).
  }
}
