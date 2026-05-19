/**
 * safe-mode — type vocabulary.
 *
 * The confidence monitor tracks three signals per turn:
 *
 *   1. LLM response **perplexity** (or any "uncertainty" proxy the
 *      caller wants to feed — confidence-from-judge, sample-disagree
 *      rate, etc.). 0..1, LOWER = better. The substrate doesn't care
 *      what the caller computes; it cares about the score.
 *   2. Tool **failure rate** in a rolling window (failures / total).
 *   3. Auto-mode classifier's **borderline streak** count.
 *
 * Each signal has a threshold; crossing TWO of three (configurable)
 * trips safe-mode. The trigger is sticky: once tripped, the kernel
 * surfaces `SafeModeEntry` and the owner has to pick a path forward.
 */

export type SafeModeChoice =
  | 'take-over'
  | 'try-different-approach'
  | 'continue-anyway';

export interface ConfidenceSample {
  /** 0..1, lower = more uncertain. */
  readonly perplexity: number;
  /** True if the most recent tool call failed. */
  readonly toolFailure: boolean;
  /** Borderline streak from the auto-mode boundary detector. */
  readonly borderlineStreak: number;
}

export interface SafeModeThresholds {
  /** Perplexity above this => signal is "uncertain". Default 0.65. */
  readonly perplexityCeiling: number;
  /**
   * Tool failure rate in the rolling window above this => signal is
   * "unstable". Default 0.4 (40%).
   */
  readonly toolFailureRateCeiling: number;
  /** Borderline streak at-or-above this => signal is "boundary-near". Default 2. */
  readonly borderlineStreakCeiling: number;
  /** Window size in samples for failure-rate computation. Default 5. */
  readonly windowSize: number;
  /**
   * Number of signals that must be "tripped" simultaneously to enter
   * safe mode. Default 2.
   */
  readonly minTrippedSignals: number;
}

export const DEFAULT_THRESHOLDS: SafeModeThresholds = Object.freeze({
  perplexityCeiling: 0.65,
  toolFailureRateCeiling: 0.4,
  borderlineStreakCeiling: 2,
  windowSize: 5,
  minTrippedSignals: 2,
});

export interface SafeModeState {
  readonly window: ReadonlyArray<ConfidenceSample>;
  readonly tripped: boolean;
  readonly trippedReasons: ReadonlyArray<string>;
}

export const INITIAL_SAFE_MODE_STATE: SafeModeState = Object.freeze({
  window: [],
  tripped: false,
  trippedReasons: [],
});

// ─────────────────────────────────────────────────────────────────────
// Chat message envelope
// ─────────────────────────────────────────────────────────────────────

export interface SafeModeEntryMessage {
  /** Header shown to the owner. */
  readonly title: string;
  /** Plain-English explanation of why we're slowing down. */
  readonly explanation: string;
  /** Reasons (one per tripped signal). */
  readonly reasons: ReadonlyArray<string>;
  /** Three buttons the owner can click. */
  readonly buttons: ReadonlyArray<{
    readonly id: SafeModeChoice;
    readonly label: string;
    readonly description: string;
  }>;
}
