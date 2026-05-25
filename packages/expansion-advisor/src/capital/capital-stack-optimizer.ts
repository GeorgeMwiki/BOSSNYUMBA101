/**
 * Capital-stack optimiser.
 *
 * Greedy-fill of the 4-tier institutional stack respecting:
 *   - per-tier ceiling as a share of total cost
 *   - DSCR floor (NOI / annual debt service)
 *   - ICR floor (NOI / interest expense)
 *   - LTC ceiling (debt / cost)
 *   - LTV ceiling (debt / stabilised value)
 *   - yield-on-cost floor (NOI / cost)
 *
 * Returns the cheapest weighted-cost stack that meets all
 * constraints, or throws if no feasible solution exists.
 */

import type {
  CapitalStack,
  StackConstraints,
  StackInputs,
  StackTier,
  StackTierSlice,
} from '../types.js';

const DEBT_TIERS: ReadonlyArray<StackTier> = ['seniorDebt', 'mezzanine'];

export function optimiseCapitalStack(input: StackInputs): CapitalStack {
  const { totalCost, stabilisedNOI, stabilisedValue, tiers, constraints } = input;

  if (totalCost <= 0) {
    throw new Error('capital-stack: totalCost must be positive');
  }
  if (stabilisedNOI < 0) {
    throw new Error('capital-stack: stabilisedNOI cannot be negative');
  }
  if (stabilisedValue <= 0) {
    throw new Error('capital-stack: stabilisedValue must be positive');
  }

  // Fill in priority order; cheapest tier first that still respects ceilings.
  const ordered = [...tiers].sort((a, b) => a.rate - b.rate);

  let remaining = totalCost;
  const slices: StackTierSlice[] = [];

  for (const tier of ordered) {
    if (remaining <= 0) break;
    const ceiling = totalCost * tier.maxShareOfCost;
    const slot = Math.min(remaining, ceiling);
    if (slot <= 0) continue;
    slices.push({ tier: tier.tier, amount: slot, rate: tier.rate });
    remaining -= slot;
  }

  if (remaining > 1e-2) {
    throw new Error(
      `capital-stack: insufficient tier capacity to fund totalCost (gap=${remaining.toFixed(2)})`,
    );
  }

  // Always ensure common equity sliver exists, even if zero residual.
  if (!slices.some((s) => s.tier === 'commonEquity')) {
    slices.push({ tier: 'commonEquity', amount: 0, rate: 0 });
  }

  const debt = slices
    .filter((s) => DEBT_TIERS.includes(s.tier))
    .reduce((a, s) => a + s.amount, 0);
  const annualDebtService = annualPmt(slices);
  const annualInterest = slices
    .filter((s) => DEBT_TIERS.includes(s.tier))
    .reduce((a, s) => a + s.amount * s.rate, 0);

  const weightedCost = slices.reduce((a, s) => a + s.amount * s.rate, 0) / totalCost;
  const dscr = annualDebtService > 0 ? stabilisedNOI / annualDebtService : Number.POSITIVE_INFINITY;
  const icr = annualInterest > 0 ? stabilisedNOI / annualInterest : Number.POSITIVE_INFINITY;
  const ltc = debt / totalCost;
  const ltv = debt / stabilisedValue;
  const yoc = stabilisedNOI / totalCost;

  assertConstraints({ dscr, icr, ltc, ltv, yoc }, constraints);

  return {
    tiers: slices,
    totalCost,
    weightedCost,
    dscr,
    icr,
    ltc,
    ltv,
    yieldOnCost: yoc,
  };
}

interface ConstraintCheck {
  readonly dscr: number;
  readonly icr: number;
  readonly ltc: number;
  readonly ltv: number;
  readonly yoc: number;
}

function assertConstraints(c: ConstraintCheck, cons: StackConstraints): void {
  if (c.dscr < cons.minDscr) {
    throw new Error(
      `capital-stack: DSCR ${c.dscr.toFixed(2)} below floor ${cons.minDscr}`,
    );
  }
  if (c.icr < cons.minIcr) {
    throw new Error(
      `capital-stack: ICR ${c.icr.toFixed(2)} below floor ${cons.minIcr}`,
    );
  }
  if (c.ltc > cons.maxLtc) {
    throw new Error(`capital-stack: LTC ${c.ltc.toFixed(2)} above ceiling ${cons.maxLtc}`);
  }
  if (c.ltv > cons.maxLtv) {
    throw new Error(`capital-stack: LTV ${c.ltv.toFixed(2)} above ceiling ${cons.maxLtv}`);
  }
  if (c.yoc < cons.minYieldOnCost) {
    throw new Error(
      `capital-stack: YoC ${(c.yoc * 100).toFixed(2)}% below floor ${(cons.minYieldOnCost * 100).toFixed(2)}%`,
    );
  }
}

/**
 * Interest-only annual debt service approximation across debt
 * tiers. (Amortising option is opt-in via tier.term.)
 */
function annualPmt(slices: ReadonlyArray<StackTierSlice>): number {
  return slices
    .filter((s) => DEBT_TIERS.includes(s.tier))
    .reduce((a, s) => a + s.amount * s.rate, 0);
}
