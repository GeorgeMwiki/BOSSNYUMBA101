/**
 * confidence-monitor — pure state-machine that advances on every
 * sampled tuple. Returns the new state + a fresh `tripped` flag.
 *
 * The algorithm:
 *
 *   1. Append the latest `ConfidenceSample` to the rolling window
 *      (length `windowSize`).
 *   2. Compute three booleans from the window:
 *        - perplexityHigh : latest sample's perplexity above ceiling
 *        - failureRateHigh: failures/total in window above ceiling
 *        - borderlineNear : latest borderlineStreak at-or-above ceiling
 *   3. Count `true` flags. If >= `minTrippedSignals`, mark tripped.
 *   4. Return the new state.
 *
 * Once tripped, the flag stays sticky until `resetSafeModeState(...)`.
 */

import type {
  ConfidenceSample,
  SafeModeState,
  SafeModeThresholds,
} from './types.js';
import { DEFAULT_THRESHOLDS, INITIAL_SAFE_MODE_STATE } from './types.js';

export interface AdvanceSafeModeInput {
  readonly prev: SafeModeState;
  readonly sample: ConfidenceSample;
  readonly thresholds?: Partial<SafeModeThresholds>;
}

export interface SafeModeAdvanceResult {
  readonly state: SafeModeState;
  /** True only on the transition from not-tripped to tripped. */
  readonly justTripped: boolean;
  /** Reasons rendered as user-facing strings — populated when tripped. */
  readonly reasons: ReadonlyArray<string>;
}

export function advanceSafeModeState(
  input: AdvanceSafeModeInput,
): SafeModeAdvanceResult {
  const t: SafeModeThresholds = { ...DEFAULT_THRESHOLDS, ...input.thresholds };

  const window = trimWindow(
    [...input.prev.window, input.sample],
    t.windowSize,
  );

  const perplexityHigh = input.sample.perplexity > t.perplexityCeiling;
  const failureRateHigh = failureRate(window) > t.toolFailureRateCeiling;
  const borderlineNear = input.sample.borderlineStreak >= t.borderlineStreakCeiling;

  const tripFlags = [perplexityHigh, failureRateHigh, borderlineNear];
  const trippedCount = tripFlags.filter(Boolean).length;
  const nowTripped =
    input.prev.tripped || trippedCount >= t.minTrippedSignals;

  const reasons: string[] = [];
  if (perplexityHigh) {
    reasons.push(
      `perplexity ${input.sample.perplexity.toFixed(2)} > ${t.perplexityCeiling}`,
    );
  }
  if (failureRateHigh) {
    reasons.push(
      `tool failure rate ${failureRate(window).toFixed(2)} > ${t.toolFailureRateCeiling}`,
    );
  }
  if (borderlineNear) {
    reasons.push(
      `borderline-streak ${input.sample.borderlineStreak} ≥ ${t.borderlineStreakCeiling}`,
    );
  }

  const state: SafeModeState = Object.freeze({
    window: Object.freeze([...window]),
    tripped: nowTripped,
    trippedReasons: nowTripped
      ? Object.freeze(reasons.length > 0 ? reasons : [...input.prev.trippedReasons])
      : input.prev.trippedReasons,
  });

  return {
    state,
    justTripped: !input.prev.tripped && nowTripped,
    reasons,
  };
}

export function resetSafeModeState(): SafeModeState {
  return INITIAL_SAFE_MODE_STATE;
}

function trimWindow(
  window: ReadonlyArray<ConfidenceSample>,
  size: number,
): ConfidenceSample[] {
  const n = Math.max(1, size);
  if (window.length <= n) return [...window];
  return window.slice(window.length - n);
}

function failureRate(window: ReadonlyArray<ConfidenceSample>): number {
  if (window.length === 0) return 0;
  let f = 0;
  for (const s of window) if (s.toolFailure) f++;
  return f / window.length;
}
