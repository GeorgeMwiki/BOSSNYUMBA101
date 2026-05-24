/**
 * Change-order risk scorer — 12-axis root-cause model with
 * preventive controls. Each control reduces the probability of
 * the corresponding cause; the residual probability × median impact
 * is the risk-weighted impact.
 *
 * Authority: Construction Industry Institute (CII) *RT-43 Final
 * Report* 2024, ENR Cost Report 2026.
 *
 * Median impact percentages from CII RT-43 Table 4 (% of contract).
 */

import type {
  ChangeOrderRiskInputs,
  ChangeOrderRiskResult,
  ChangeOrderRootCause,
} from '../types.js';

interface CauseModel {
  readonly cause: ChangeOrderRootCause;
  readonly baseProbability: number;
  readonly medianImpactPct: number;
  readonly mitigant: (i: ChangeOrderRiskInputs) => number; // returns 0..1 reduction factor (1 = full mitigation)
}

const CAUSES: ReadonlyArray<CauseModel> = [
  {
    cause: 'owner-scope-change',
    baseProbability: 0.85,
    medianImpactPct: 0.045,
    mitigant: (i) => i.scopeDiscipline,
  },
  {
    cause: 'drawing-errors',
    baseProbability: 0.70,
    medianImpactPct: 0.038,
    mitigant: (i) => (i.peerReviewedCD ? 0.70 : 0) + 0.30 * i.designCompleteness,
  },
  {
    cause: 'differing-site-conditions',
    baseProbability: 0.40,
    medianImpactPct: 0.029,
    mitigant: (i) => (i.preBidGeotech ? 0.80 : 0.10),
  },
  {
    cause: 'permit-changes',
    baseProbability: 0.45,
    medianImpactPct: 0.022,
    mitigant: (_i) => 0.20,
  },
  {
    cause: 'material-substitution',
    baseProbability: 0.55,
    medianImpactPct: 0.019,
    mitigant: (i) => (i.specBackupsPresent ? 0.75 : 0.10),
  },
  {
    cause: 'schedule-acceleration',
    baseProbability: 0.40,
    medianImpactPct: 0.017,
    mitigant: (i) => (i.committedAtP80 ? 0.80 : 0.10),
  },
  {
    cause: 'sub-default',
    baseProbability: 0.20,
    medianImpactPct: 0.016,
    mitigant: (i) => (i.bondedLargeTrades ? 0.85 : 0.10),
  },
  {
    cause: 'weather',
    baseProbability: 0.60,
    medianImpactPct: 0.014,
    mitigant: (i) => (i.weatherModelInUse ? 0.55 : 0.05),
  },
  {
    cause: 'labour-shortage',
    baseProbability: 0.55,
    medianImpactPct: 0.013,
    mitigant: (i) => (i.labourLocksInPlace ? 0.70 : 0.10),
  },
  {
    cause: 'coordination-conflicts',
    baseProbability: 0.70,
    medianImpactPct: 0.012,
    mitigant: (i) => (i.bimLevel >= 2 ? 0.80 : i.bimLevel === 1 ? 0.30 : 0),
  },
  {
    cause: 'ofe-delay',
    baseProbability: 0.45,
    medianImpactPct: 0.009,
    mitigant: (i) => (i.ofeScheduleAudited ? 0.65 : 0.05),
  },
  {
    cause: 'inspection-failure',
    baseProbability: 0.30,
    medianImpactPct: 0.008,
    mitigant: (i) => (i.thirdPartyQA ? 0.75 : 0.10),
  },
];

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export function scoreChangeOrderRisk(
  inputs: Readonly<ChangeOrderRiskInputs>,
): ChangeOrderRiskResult {
  const perCauseRisk = CAUSES.map((c) => {
    const reduction = clamp01(c.mitigant(inputs));
    const probability = clamp01(c.baseProbability * (1 - reduction));
    return {
      cause: c.cause,
      medianImpactPct: c.medianImpactPct,
      probabilityOfOccurrence: probability,
      riskWeightedImpactPct: probability * c.medianImpactPct,
    };
  });

  const totalExpected = perCauseRisk.reduce(
    (s, r) => s + r.riskWeightedImpactPct,
    0,
  );
  const sortedDesc = [...perCauseRisk].sort(
    (a, b) => b.riskWeightedImpactPct - a.riskWeightedImpactPct,
  );
  const top3 = sortedDesc.slice(0, 3).map((r) => r.cause);

  return {
    perCauseRisk,
    totalExpectedCOImpactPct: totalExpected,
    top3Causes: top3,
  };
}
