/**
 * Boundary detector — tracks the running count of `borderline`
 * verdicts within a session. 3 in a row -> escalate to plan mode.
 *
 * Pure state machine; the kernel owns the counter and asks this
 * module how to react after each verdict.
 */

import type { AutoModeVerdict } from '../types.js';

export interface BoundaryDetectorState {
  /** Consecutive `borderline` verdicts in this session. */
  readonly borderlineStreak: number;
  /** True after a 3-streak fires; reset only by `reset(...)`. */
  readonly inPlanModeFallback: boolean;
}

export interface BoundaryDetectorOptions {
  /** Streak threshold. Default 3. */
  readonly threshold?: number;
}

export const INITIAL_BOUNDARY_STATE: BoundaryDetectorState = Object.freeze({
  borderlineStreak: 0,
  inPlanModeFallback: false,
});

/**
 * Advance the detector by one verdict. Pure — returns the new state.
 *
 *   safe       -> streak resets to 0 (NOT inPlanModeFallback once set)
 *   unsafe     -> streak resets to 0 (unsafe is its own deny path)
 *   borderline -> streak += 1, fallback engages at threshold
 */
export function advanceBoundaryState(
  prev: BoundaryDetectorState,
  verdict: AutoModeVerdict,
  opts: BoundaryDetectorOptions = {},
): BoundaryDetectorState {
  const threshold = Math.max(1, opts.threshold ?? 3);
  if (verdict === 'borderline') {
    const next = prev.borderlineStreak + 1;
    return Object.freeze({
      borderlineStreak: next,
      inPlanModeFallback: prev.inPlanModeFallback || next >= threshold,
    });
  }
  // safe / unsafe both reset the streak. The fallback flag, once set,
  // sticks until the kernel calls `reset(...)` after the owner explicitly
  // re-engages auto mode.
  return Object.freeze({
    borderlineStreak: 0,
    inPlanModeFallback: prev.inPlanModeFallback,
  });
}

/**
 * Owner-driven reset (UI button: "OK, resume auto"). Returns to the
 * initial state.
 */
export function resetBoundaryState(): BoundaryDetectorState {
  return INITIAL_BOUNDARY_STATE;
}
