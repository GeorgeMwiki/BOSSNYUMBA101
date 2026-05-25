/**
 * Value-add scorer — 4-axis composite for in-place property
 * upside identification.
 *
 * Weights: rent gap 40, turnover 25, expense efficiency 20, capex 15.
 */

import type { ValueAddInputs, ValueAddScore } from '../types.js';

export function scoreValueAdd(input: ValueAddInputs): ValueAddScore {
  const rentGap = input.compRentPerSqm > 0
    ? Math.max(0, (input.compRentPerSqm - input.inPlaceRentPerSqm) / input.compRentPerSqm)
    : 0;
  const turnover = clamp01(input.annualTurnoverPct);
  const turnoverScore = clamp01(turnover * rentGap * 2); // turnover × mark-to-market scaled
  const expenseGap = clamp01(
    Math.max(0, input.compOperatingExpenseRatio - input.actualOperatingExpenseRatio) * 2,
  );
  const capex = clamp01(input.capexCatchUpScore);

  const total =
    0.4 * clamp01(rentGap * 2) +
    0.25 * turnoverScore +
    0.2 * expenseGap +
    0.15 * capex;

  return {
    rentGapScore: clamp01(rentGap * 2),
    turnoverScore,
    expenseEfficiencyScore: expenseGap,
    capexScore: capex,
    total,
  };
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
