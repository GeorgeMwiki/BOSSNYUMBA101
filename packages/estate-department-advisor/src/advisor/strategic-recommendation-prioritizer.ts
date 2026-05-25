/**
 * strategic-recommendation-prioritizer — MCDA ranking.
 *
 * composite = 0.45 · strategic + 0.30 · IRR_normalised + 0.25 · urgency
 *
 * Pure ranking utility used by the department-health-report composer
 * and any caller that wants a single ranked list across recommendations
 * from many advisor outputs.
 */

import type { Recommendation } from '../types.js';

const W_STRATEGIC = 0.45;
const W_IRR = 0.30;
const W_URGENCY = 0.25;

function irrNormalised(rec: Recommendation, maxIrr: number): number {
  if (rec.estimatedIrrPct === undefined) return 0;
  if (maxIrr <= 0) return 0;
  return Math.max(0, Math.min(1, rec.estimatedIrrPct / maxIrr));
}

export function prioritizeRecommendations(
  recs: ReadonlyArray<Recommendation>,
): ReadonlyArray<Recommendation> {
  const maxIrr = recs.reduce(
    (m, r) => Math.max(m, r.estimatedIrrPct ?? 0),
    0,
  );
  return [...recs]
    .map((r) => ({
      ...r,
      composite:
        W_STRATEGIC * r.strategicScore +
        W_IRR * irrNormalised(r, maxIrr) +
        W_URGENCY * r.urgencyScore,
    }))
    .sort((a, b) => b.composite - a.composite);
}

export function topNRecommendations(
  recs: ReadonlyArray<Recommendation>,
  n: number,
): ReadonlyArray<Recommendation> {
  return prioritizeRecommendations(recs).slice(0, n);
}

export const __test__ = { W_STRATEGIC, W_IRR, W_URGENCY, irrNormalised };
