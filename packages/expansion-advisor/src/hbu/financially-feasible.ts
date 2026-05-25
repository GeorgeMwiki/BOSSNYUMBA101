/**
 * HBU Gate 3 — financially feasible.
 *
 * Builds the stabilised cash-flow series for the candidate, runs
 * a Monte-Carlo sensitivity over rent ±10% and cost ±10%, and
 * passes if the median IRR ≥ hurdle and probability of NPV ≥ 0
 * exceeds the confidence target.
 */

import { irr, npv } from '../capital/irr-npv.js';
import type { CandidateUse, GateResult } from '../types.js';

export interface FinancialRules {
  readonly hurdleIrr: number;
  readonly discountRate: number;
  readonly holdPeriodYears: number;
  readonly exitCapRate: number;
  readonly confidenceTarget: number; // 0..1, share of MC paths NPV>=0
  readonly mcRuns?: number;
}

export interface FinancialEvaluation {
  readonly result: GateResult;
  readonly medianIrr: number;
  readonly medianNpv: number;
  readonly probNpvPositive: number;
  readonly meanCashflows: ReadonlyArray<number>;
}

export function financiallyFeasible(
  use: CandidateUse,
  rules: FinancialRules,
): FinancialEvaluation {
  const runs = rules.mcRuns ?? 200;
  const irrs: number[] = [];
  const npvs: number[] = [];
  let positive = 0;
  const cfAccum = new Array(rules.holdPeriodYears + 1).fill(0);

  for (let i = 0; i < runs; i += 1) {
    const rentBias = (deterministicNoise(i, 1) * 0.2) - 0.1;
    const costBias = (deterministicNoise(i, 2) * 0.2) - 0.1;
    const cf = projectCashflows(use, rules, rentBias, costBias);
    const xirr = irr(cf);
    const xnpv = npv(rules.discountRate, cf);
    irrs.push(xirr);
    npvs.push(xnpv);
    if (xnpv >= 0) positive += 1;
    for (let t = 0; t < cf.length; t += 1) cfAccum[t] += cf[t];
  }

  const meanCashflows = cfAccum.map((v) => v / runs);
  const medianIrr = median(irrs);
  const medianNpv = median(npvs);
  const probNpvPositive = positive / runs;

  const reasons: string[] = [];
  if (medianIrr < rules.hurdleIrr) {
    reasons.push(
      `median IRR ${(medianIrr * 100).toFixed(2)}% below hurdle ${(rules.hurdleIrr * 100).toFixed(2)}%`,
    );
  }
  if (probNpvPositive < rules.confidenceTarget) {
    reasons.push(
      `Pr(NPV>=0)=${probNpvPositive.toFixed(2)} below target ${rules.confidenceTarget}`,
    );
  }

  return {
    result: {
      use,
      gate: 'financiallyFeasible',
      outcome: reasons.length === 0 ? 'pass' : 'fail',
      reasons,
    },
    medianIrr,
    medianNpv,
    probNpvPositive,
    meanCashflows,
  };
}

function projectCashflows(
  use: CandidateUse,
  rules: FinancialRules,
  rentBias: number,
  costBias: number,
): number[] {
  const totalBuildCost = use.buildCostPerSqm * use.programmeSqm * (1 + costBias);
  const totalCost = totalBuildCost + use.landBasis;
  const annualRevenue = use.nlaSqm * use.stabilisedRentPerSqm * 12 * (1 + rentBias);
  const annualOpex = annualRevenue * use.operatingExpenseRatio;
  const annualNoi = annualRevenue - annualOpex;
  const exitValue = annualNoi / rules.exitCapRate;

  const cf: number[] = new Array(rules.holdPeriodYears + 1).fill(0);
  cf[0] = -totalCost;
  for (let y = 1; y <= rules.holdPeriodYears; y += 1) {
    cf[y] = annualNoi;
  }
  cf[rules.holdPeriodYears] += exitValue;
  return cf;
}

function median(arr: ReadonlyArray<number>): number {
  const sorted = [...arr].filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (sorted.length === 0) return NaN;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Deterministic noise generator (avoids `Math.random` so tests
 * are reproducible). Linear congruential PRNG with seed = (i,k).
 */
function deterministicNoise(i: number, k: number): number {
  const seed = (i * 9301 + k * 49297) % 233280;
  return seed / 233280;
}
