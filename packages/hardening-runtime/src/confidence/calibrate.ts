/**
 * Calibration — combine verbalized confidence with logprob-derived
 * probability into a single `calibrated` score.
 *
 * L3 §1 #1 — top-leverage hardening pattern (score 25). The K-B safe-mode
 * fallback and the K-E autonomy slider both consume the calibrated score.
 *
 * Calibration curve (verbatim from L3 §4):
 *   model's verbalized 8/10 ≈ true 0.65
 *   model's verbalized 9/10 ≈ true 0.75
 *   model's verbalized 10/10 ≈ true 0.85
 *
 * Wang et al. 2026 show verbalized confidence is *separable* from actual
 * calibration — the model can lie. So we ground on logprob when available,
 * and use verbalized only as a tie-breaker / fallback.
 *
 * Pure functions only. No side-effects. Immutable inputs and outputs.
 */

/**
 * Published L3 calibration curve. Maps the model's verbalized score
 * (after normalising 0..1) to its empirical true probability.
 *
 * Domain: [0, 1]   Range: [0, 1]   Monotonically non-decreasing.
 */
export const VERBALIZED_CALIBRATION_CURVE: ReadonlyArray<
  readonly [number, number]
> = Object.freeze([
  [0.0, 0.0],
  [0.1, 0.05],
  [0.2, 0.1],
  [0.3, 0.15],
  [0.4, 0.22],
  [0.5, 0.32],
  [0.6, 0.45],
  [0.7, 0.55],
  [0.8, 0.65],
  [0.9, 0.75],
  [1.0, 0.85],
]);

/**
 * Linearly interpolate `verbalized` onto the calibration curve.
 *
 * Returns the empirical true probability the curve predicts.
 *
 * @param verbalized — model's self-reported confidence (0..1). NaN, +/-Inf
 *   and out-of-range values are clamped to [0,1].
 */
export function calibrateVerbalized(verbalized: number): number {
  if (!Number.isFinite(verbalized)) return 0;
  const x = Math.min(1, Math.max(0, verbalized));
  const curve = VERBALIZED_CALIBRATION_CURVE;
  // Find the segment that contains x. Curve has 11 points (0.0 step 0.1).
  for (let i = 0; i < curve.length - 1; i += 1) {
    const left = curve[i];
    const right = curve[i + 1];
    // Guard for noUncheckedIndexedAccess.
    if (left === undefined || right === undefined) continue;
    const [x0, y0] = left;
    const [x1, y1] = right;
    if (x >= x0 && x <= x1) {
      if (x1 === x0) return y0;
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  // Fallthrough — should not happen with a sane curve.
  return x;
}

/**
 * Combine verbalized + logprob into a single calibrated score.
 *
 * Strategy (L3 §4 recommendation):
 *   - If logprob is present: 70/30 logprob/verbalized-calibrated weighting.
 *     Logprob is harder to spoof.
 *   - If logprob is null: fall back to verbalized-calibrated only.
 *   - If both are null: return 0.5 (no signal, route via plan-mode).
 *
 * @param verbalized — model's self-reported 0..1, or null.
 * @param logprob — joint logprob of answer tokens (NEGATIVE number) from
 *   the API, then exponentiated to 0..1 probability, or null.
 */
export function combineCalibrated(
  verbalized: number | null,
  logprob: number | null,
): number {
  if (verbalized === null && logprob === null) return 0.5;
  if (verbalized !== null && logprob === null) {
    return clamp01(calibrateVerbalized(verbalized));
  }
  if (verbalized === null && logprob !== null) {
    return clamp01(logprob);
  }
  // Both present.
  const v = clamp01(calibrateVerbalized(verbalized as number));
  const l = clamp01(logprob as number);
  return 0.7 * l + 0.3 * v;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}
