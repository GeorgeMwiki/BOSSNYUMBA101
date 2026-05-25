/**
 * Defeasance vs Yield-Maintenance cost comparator.
 *
 * Authority: Standard & Poor's *Defeasance Methodology* 2024.
 *
 * Defeasance cost ≈ PV of remaining payments at Treasury-strip
 * rates minus principal balance. Higher when Treasury rates fall
 * below the loan coupon.
 *
 * Yield-maintenance ≈ PV of yield spread × remaining balance,
 * standard formula:
 *   YM = (loan_rate - treasury_rate) × balance × annuity_factor
 *   annuity_factor = [1 - (1 + treasury_rate)^-n] / treasury_rate
 *
 * For simplicity we model both as the same notional balance + yearly
 * service, since the PV-of-payments-minus-balance for defeasance
 * collapses to the same closed form when amortisation matches.
 */

import type {
  DefeasanceVsYMInputs,
  DefeasanceVsYMResult,
} from '../types.js';

function annuityFactor(rate: number, years: number): number {
  if (rate <= 0) return years;
  return (1 - Math.pow(1 + rate, -years)) / rate;
}

export function compareDefeasanceVsYM(
  inputs: Readonly<DefeasanceVsYMInputs>,
): DefeasanceVsYMResult {
  if (inputs.remainingBalance <= 0 || inputs.remainingYears <= 0) {
    return {
      defeasanceCost: 0,
      yieldMaintenanceCost: 0,
      cheaperOption: 'yield-maintenance',
      delta: 0,
    };
  }
  // Interest-only debt service (simplified) plus terminal principal repayment
  const annualService = inputs.remainingBalance * inputs.originalRatePct;
  // PV of remaining periodic interest payments at Treasury strip rates
  const pvInterest = annualService * annuityFactor(inputs.currentTreasuryPct, inputs.remainingYears);
  // PV of terminal principal repayment
  const pvPrincipal =
    inputs.remainingBalance /
    Math.pow(1 + inputs.currentTreasuryPct, inputs.remainingYears);
  // Defeasance cost = PV of all remaining cash flows at Treasury - existing balance
  const defeasanceCost = Math.max(0, pvInterest + pvPrincipal - inputs.remainingBalance);
  // YM = (loan rate - treasury rate) × balance × annuity factor
  const ymCost = Math.max(
    0,
    (inputs.originalRatePct - inputs.currentTreasuryPct) *
      inputs.remainingBalance *
      annuityFactor(inputs.currentTreasuryPct, inputs.remainingYears),
  );
  const cheaperOption = defeasanceCost <= ymCost ? 'defeasance' : 'yield-maintenance';
  return {
    defeasanceCost,
    yieldMaintenanceCost: ymCost,
    cheaperOption,
    delta: Math.abs(defeasanceCost - ymCost),
  };
}
