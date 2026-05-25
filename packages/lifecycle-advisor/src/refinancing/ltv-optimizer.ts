/**
 * LTV optimiser — fills a multi-tranche debt stack against
 * stabilised value subject to DSCR + debt-yield constraints.
 *
 * Authority: CMSA / CREFC IRP 2024, MBA 2026 Commercial Real
 * Estate Outlook.
 *
 * Algorithm:
 *   1. Order tranches cheapest-to-most-expensive (typical: agency
 *      → life-co → CMBS → bank → debt-fund → mezz).
 *   2. Fill each tranche up to its maxLTVShare of stabilised value.
 *   3. Stop when DSCR floor would be breached on next $.
 */

import type {
  DebtTranche,
  LenderType,
  LTVOptimizationInputs,
  LTVOptimizationResult,
} from '../types.js';

const TRANCHE_PRIORITY: ReadonlyArray<LenderType> = [
  'agency',
  'ea-tier-1-bank',
  'life-co',
  'cmbs',
  'bank',
  'debt-fund',
  'mezz',
];

function priorityOf(t: LenderType): number {
  const i = TRANCHE_PRIORITY.indexOf(t);
  return i === -1 ? TRANCHE_PRIORITY.length : i;
}

function annualDebtService(amount: number, ratePct: number, amortYears: number): number {
  if (amount <= 0) return 0;
  const monthlyRate = ratePct / 12;
  const n = amortYears * 12;
  if (monthlyRate === 0) return amount / amortYears;
  const monthly = (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
  return monthly * 12;
}

export function optimiseLTV(
  inputs: Readonly<LTVOptimizationInputs>,
): LTVOptimizationResult {
  if (inputs.stabilisedValue <= 0) {
    throw new Error('optimiseLTV: stabilisedValue must be > 0');
  }
  const ordered = [...inputs.tranches].sort(
    (a, b) => priorityOf(a.type) - priorityOf(b.type),
  );

  const allocated: DebtTranche[] = [];
  let totalDebt = 0;
  let totalDS = 0;
  const violatedConstraints: string[] = [];

  for (const t of ordered) {
    const maxByLTV = inputs.stabilisedValue * t.maxLTVShare;
    // What can we add without breaking DSCR or debt-yield?
    const remainingDSCRRoom = Math.max(
      0,
      inputs.stabilisedNOI / inputs.targetDSCR - totalDS,
    );
    let candidate = maxByLTV;
    let candidateDS = annualDebtService(candidate, t.ratePct, t.amortYears);
    if (candidateDS > remainingDSCRRoom) {
      // Binary-search descending to fit
      let lo = 0;
      let hi = maxByLTV;
      for (let i = 0; i < 24; i += 1) {
        const mid = (lo + hi) / 2;
        const ds = annualDebtService(mid, t.ratePct, t.amortYears);
        if (ds > remainingDSCRRoom) hi = mid;
        else lo = mid;
      }
      candidate = lo;
      candidateDS = annualDebtService(candidate, t.ratePct, t.amortYears);
    }
    // Debt-yield cap on incremental total
    const newTotal = totalDebt + candidate;
    if (newTotal > 0 && inputs.stabilisedNOI / newTotal < inputs.targetDebtYield) {
      const maxByDY = inputs.stabilisedNOI / inputs.targetDebtYield - totalDebt;
      candidate = Math.max(0, Math.min(candidate, maxByDY));
      candidateDS = annualDebtService(candidate, t.ratePct, t.amortYears);
    }
    if (candidate > 0) {
      allocated.push({
        type: t.type,
        amount: candidate,
        ratePct: t.ratePct,
        termYears: t.termYears,
        amortYears: t.amortYears,
        maxLTV: t.maxLTVShare,
      });
      totalDebt += candidate;
      totalDS += candidateDS;
    }
  }

  const weightedRate = totalDebt > 0
    ? allocated.reduce((acc, t) => acc + t.amount * t.ratePct, 0) / totalDebt
    : 0;

  const totalLTV = totalDebt / inputs.stabilisedValue;
  const dscr = totalDS > 0 ? inputs.stabilisedNOI / totalDS : Infinity;
  const debtYield = totalDebt > 0 ? inputs.stabilisedNOI / totalDebt : Infinity;

  if (dscr < inputs.targetDSCR - 1e-6) {
    violatedConstraints.push(`DSCR ${dscr.toFixed(3)} < target ${inputs.targetDSCR.toFixed(3)}`);
  }
  if (debtYield < inputs.targetDebtYield - 1e-6) {
    violatedConstraints.push(
      `debt-yield ${debtYield.toFixed(4)} < target ${inputs.targetDebtYield.toFixed(4)}`,
    );
  }

  return {
    allocatedTranches: allocated,
    weightedRate,
    totalDebt,
    totalLTV,
    dscr,
    debtYield,
    feasible: violatedConstraints.length === 0,
    violatedConstraints,
  };
}
