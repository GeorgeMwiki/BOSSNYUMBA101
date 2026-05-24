/**
 * Feasibility analyzer — USPAP Standard 9 §9-2 (b) + IDM ProForma.
 *
 * Authority: Appraisal Institute *USPAP Standard 9 — Development
 * Property Analysis* (2024 ed.), Urban Land Institute *Institutional
 * Development Manual ProForma 7-step*, ULI *Real Estate Development —
 * Principles and Process* 5th ed.
 *
 * Returns go / conditional-go / redesign verdict with the failing
 * gates explicitly listed so the project team can prioritise rework.
 */

import type { FeasibilityInputs, FeasibilityResult } from '../types.js';

const YIELD_SPREAD_BPS_MIN = 150;
const IRR_SPREAD_BPS_MIN = 300;
const LTC_MAX = 0.75;
const LTV_MAX = 0.65;
const HARD_CONTINGENCY_MIN = 0.075;
const SOFT_CONTINGENCY_MIN = 0.10;
const EQUITY_POCKET_USAGE_MAX = 0.75;

export function analyzeFeasibility(
  inputs: Readonly<FeasibilityInputs>,
): FeasibilityResult {
  if (inputs.totalDevelopmentCost <= 0) {
    throw new Error('analyzeFeasibility: totalDevelopmentCost must be > 0');
  }
  if (inputs.ownerEquityCapacity <= 0) {
    throw new Error('analyzeFeasibility: ownerEquityCapacity must be > 0');
  }

  const untrendedYieldOnCost = inputs.stabilisedNOI / inputs.totalDevelopmentCost;
  const yieldSpreadVsCapBps =
    (untrendedYieldOnCost - inputs.goingInCapRate) * 10_000;
  const irrSpreadVsHurdleBps = (inputs.projectIRR - inputs.hurdleIRR) * 10_000;
  const equityHeadroomPct = inputs.peakEquity / inputs.ownerEquityCapacity;

  const gates = [
    {
      gate: 'positive-yield-arbitrage',
      passed: yieldSpreadVsCapBps >= YIELD_SPREAD_BPS_MIN,
      threshold: `>= ${YIELD_SPREAD_BPS_MIN} bps`,
      actual: `${yieldSpreadVsCapBps.toFixed(0)} bps`,
    },
    {
      gate: 'development-premium-irr',
      passed: irrSpreadVsHurdleBps >= IRR_SPREAD_BPS_MIN,
      threshold: `>= ${IRR_SPREAD_BPS_MIN} bps`,
      actual: `${irrSpreadVsHurdleBps.toFixed(0)} bps`,
    },
    {
      gate: 'ltc-cap',
      passed: inputs.ltc <= LTC_MAX,
      threshold: `<= ${(LTC_MAX * 100).toFixed(0)}%`,
      actual: `${(inputs.ltc * 100).toFixed(1)}%`,
    },
    {
      gate: 'ltv-cap',
      passed: inputs.ltv <= LTV_MAX,
      threshold: `<= ${(LTV_MAX * 100).toFixed(0)}%`,
      actual: `${(inputs.ltv * 100).toFixed(1)}%`,
    },
    {
      gate: 'equity-pocket-cushion',
      passed: equityHeadroomPct <= EQUITY_POCKET_USAGE_MAX,
      threshold: `<= ${(EQUITY_POCKET_USAGE_MAX * 100).toFixed(0)}% of pocket`,
      actual: `${(equityHeadroomPct * 100).toFixed(1)}%`,
    },
    {
      gate: 'hard-contingency-floor',
      passed: inputs.hardContingencyPct >= HARD_CONTINGENCY_MIN,
      threshold: `>= ${(HARD_CONTINGENCY_MIN * 100).toFixed(1)}%`,
      actual: `${(inputs.hardContingencyPct * 100).toFixed(1)}%`,
    },
    {
      gate: 'soft-contingency-floor',
      passed: inputs.softContingencyPct >= SOFT_CONTINGENCY_MIN,
      threshold: `>= ${(SOFT_CONTINGENCY_MIN * 100).toFixed(1)}%`,
      actual: `${(inputs.softContingencyPct * 100).toFixed(1)}%`,
    },
  ];

  const failingGates = gates.filter((g) => !g.passed).map((g) => g.gate);
  let verdict: FeasibilityResult['verdict'];
  if (failingGates.length === 0) verdict = 'go';
  else if (failingGates.length === 1) verdict = 'conditional-go';
  else verdict = 'redesign';

  return {
    assetId: inputs.assetId,
    verdict,
    untrendedYieldOnCost,
    yieldSpreadVsCapBps,
    irrSpreadVsHurdleBps,
    equityHeadroomPct,
    gateResults: gates,
    failingGates,
  };
}
