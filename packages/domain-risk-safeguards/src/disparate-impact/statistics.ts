/**
 * Statistical primitives for disparate-impact testing.
 *
 * Three independent tests stacked, per the SafeRent / EEOC playbook:
 *   1. 4/5ths rule (Uniform Guidelines on Employee Selection Procedures,
 *      adapted to housing by HUD May-2024)
 *   2. Chi-squared independence test (cohort × outcome)
 *   3. Cohen's d effect size (approve-rate gap magnitude)
 *
 * No external dependencies — all math is implemented inline.
 */

import type {
  ChiSquaredResult,
  CohensDResult,
  DecisionRecord,
  FourFifthsResult,
  ProtectedClassProxy,
  ScreeningActionClass,
} from '../types.js';

// ---------------------------------------------------------------------------
// Bucketing
// ---------------------------------------------------------------------------

interface BucketCounts {
  readonly approve: number;
  readonly deny: number;
}

function bucketDecisions(
  records: ReadonlyArray<DecisionRecord>,
): ReadonlyMap<string, BucketCounts> {
  const counts = new Map<string, { approve: number; deny: number }>();
  for (const r of records) {
    const existing = counts.get(r.bucket) ?? { approve: 0, deny: 0 };
    const next =
      r.outcome === 'approve'
        ? { approve: existing.approve + 1, deny: existing.deny }
        : { approve: existing.approve, deny: existing.deny + 1 };
    counts.set(r.bucket, next);
  }
  return new Map(
    Array.from(counts.entries()).map(([bucket, c]) => [
      bucket,
      Object.freeze({ approve: c.approve, deny: c.deny }),
    ]),
  );
}

// ---------------------------------------------------------------------------
// 4/5ths Rule
// ---------------------------------------------------------------------------

/**
 * Uniform Guidelines on Employee Selection Procedures § 1607.4(D):
 *   "A selection rate for any race, sex, or ethnic group which is less
 *    than four-fifths (4/5) (or eighty percent) of the rate for the
 *    group with the highest rate will generally be regarded by the
 *    Federal enforcement agencies as evidence of adverse impact."
 *
 * Adapted by HUD May-2024 to housing AI screening.
 */
export function computeFourFifths(
  records: ReadonlyArray<DecisionRecord>,
  proxy: ProtectedClassProxy,
  actionClass: ScreeningActionClass,
): FourFifthsResult {
  const buckets = bucketDecisions(records);
  const bucketRates = Array.from(buckets.entries())
    .map(([bucket, c]) => {
      const totalDecisions = c.approve + c.deny;
      const approveRate = totalDecisions === 0 ? 0 : c.approve / totalDecisions;
      return Object.freeze({ bucket, approveRate, totalDecisions });
    })
    .sort((a, b) => a.bucket.localeCompare(b.bucket));

  if (bucketRates.length === 0) {
    return Object.freeze({
      proxy,
      actionClass,
      bucketRates: Object.freeze([]),
      highestRate: 0,
      lowestRate: 0,
      impactRatio: 1, // vacuously passes
      passes: true,
    });
  }

  const highestRate = bucketRates.reduce((m, b) => (b.approveRate > m ? b.approveRate : m), 0);
  const lowestRate = bucketRates.reduce((m, b) => (b.approveRate < m ? b.approveRate : m), Infinity);
  // Guard: if highest == 0, ratio is meaningless — treat as pass to avoid NaN.
  const impactRatio = highestRate === 0 ? 1 : lowestRate / highestRate;
  const passes = impactRatio >= 0.8;
  return Object.freeze({
    proxy,
    actionClass,
    bucketRates: Object.freeze(bucketRates),
    highestRate,
    lowestRate: Number.isFinite(lowestRate) ? lowestRate : 0,
    impactRatio,
    passes,
  });
}

// ---------------------------------------------------------------------------
// Chi-Squared Test
// ---------------------------------------------------------------------------

/**
 * Chi-squared statistic for a 2 × k contingency table (k = bucket count).
 *
 *   X^2 = sum_ij (O_ij - E_ij)^2 / E_ij
 *
 * Degrees of freedom = (k - 1) * (rows - 1) = k - 1 (since rows = 2).
 *
 * Critical values at α = 0.05 are precomputed for df = 1..20. Tests with
 * df > 20 fall back to a safe over-rejection threshold.
 */
const CHI_SQ_CRITICAL_0P05: ReadonlyArray<number> = Object.freeze([
  // df=0 unused
  0,
  3.841, 5.991, 7.815, 9.488, 11.07, 12.592, 14.067, 15.507, 16.919, 18.307,
  19.675, 21.026, 22.362, 23.685, 24.996, 26.296, 27.587, 28.869, 30.144, 31.41,
]);

export function computeChiSquared(
  records: ReadonlyArray<DecisionRecord>,
  proxy: ProtectedClassProxy,
  actionClass: ScreeningActionClass,
): ChiSquaredResult {
  const buckets = bucketDecisions(records);
  const k = buckets.size;
  const df = Math.max(1, k - 1);
  const criticalAt0p05 =
    df < CHI_SQ_CRITICAL_0P05.length ? (CHI_SQ_CRITICAL_0P05[df] ?? 0) : 31.41 + 0.5 * (df - 20);

  if (k < 2) {
    return Object.freeze({
      proxy,
      actionClass,
      degreesOfFreedom: df,
      chiSquared: 0,
      criticalAt0p05,
      rejectsNull: false,
    });
  }

  const totalApprove = Array.from(buckets.values()).reduce((s, c) => s + c.approve, 0);
  const totalDeny = Array.from(buckets.values()).reduce((s, c) => s + c.deny, 0);
  const grandTotal = totalApprove + totalDeny;

  if (grandTotal === 0) {
    return Object.freeze({
      proxy,
      actionClass,
      degreesOfFreedom: df,
      chiSquared: 0,
      criticalAt0p05,
      rejectsNull: false,
    });
  }

  let chi = 0;
  for (const c of buckets.values()) {
    const bucketTotal = c.approve + c.deny;
    if (bucketTotal === 0) continue;
    const expectedApprove = (bucketTotal * totalApprove) / grandTotal;
    const expectedDeny = (bucketTotal * totalDeny) / grandTotal;
    if (expectedApprove > 0) {
      chi += Math.pow(c.approve - expectedApprove, 2) / expectedApprove;
    }
    if (expectedDeny > 0) {
      chi += Math.pow(c.deny - expectedDeny, 2) / expectedDeny;
    }
  }

  return Object.freeze({
    proxy,
    actionClass,
    degreesOfFreedom: df,
    chiSquared: chi,
    criticalAt0p05,
    rejectsNull: chi > criticalAt0p05,
  });
}

// ---------------------------------------------------------------------------
// Cohen's d
// ---------------------------------------------------------------------------

/**
 * Cohen's d on approve-rate proportions between the highest- and
 * lowest-rate buckets. Using Cohen's h-style transformation for
 * proportions (arcsine root) avoids divide-by-zero on extreme buckets.
 *
 *   h = 2 * arcsin(sqrt(p1)) - 2 * arcsin(sqrt(p2))
 *
 * Magnitude classification follows Cohen (1988):
 *   |h| < 0.2  → small (or negligible if < 0.05)
 *   |h| < 0.5  → small
 *   |h| < 0.8  → medium
 *   |h| >= 0.8 → large
 */
export function computeCohensD(
  records: ReadonlyArray<DecisionRecord>,
  proxy: ProtectedClassProxy,
  actionClass: ScreeningActionClass,
): CohensDResult {
  const buckets = bucketDecisions(records);
  if (buckets.size < 2) {
    return Object.freeze({ proxy, actionClass, d: 0, magnitude: 'negligible' });
  }
  const rates = Array.from(buckets.values()).map((c) => {
    const total = c.approve + c.deny;
    return total === 0 ? 0 : c.approve / total;
  });
  const highest = Math.max(...rates);
  const lowest = Math.min(...rates);
  const phi1 = 2 * Math.asin(Math.sqrt(highest));
  const phi2 = 2 * Math.asin(Math.sqrt(lowest));
  const d = Math.abs(phi1 - phi2);
  const magnitude: CohensDResult['magnitude'] =
    d >= 0.8 ? 'large' : d >= 0.5 ? 'medium' : d >= 0.2 ? 'small' : 'negligible';
  return Object.freeze({ proxy, actionClass, d, magnitude });
}
