/**
 * Refi proceeds optimiser — cash-out vs rate-and-term decision.
 *
 * Authority: MBA 2026 Commercial Mortgage Outlook, Trepp Refi
 * Tracker 2026.
 *
 * Decision:
 *   - Cash-out only if (cash_proceeds × IRR_reinvest) >
 *     extra_interest_after_tax AND new_DSCR ≥ 1.30×.
 *   - Otherwise rate-and-term.
 *   - If new debt > existing + closing AND DSCR < 1.20× → do-not-refi.
 */

import type { RefiProceedsInputs, RefiProceedsResult } from '../types.js';

const DSCR_FLOOR_FOR_CASHOUT = 1.30;
const DSCR_FLOOR_FOR_ANY_REFI = 1.20;

export function optimiseRefiProceeds(
  inputs: Readonly<RefiProceedsInputs>,
): RefiProceedsResult {
  const cashOutAmount = Math.max(
    0,
    inputs.newDebtAmount - inputs.existingDebtBalance - inputs.closingCosts,
  );
  const extraInterestAnnual =
    inputs.newDebtAmount * inputs.newDebtRate -
    inputs.existingDebtBalance * inputs.existingDebtRate;
  const extraInterestAfterTax = extraInterestAnnual * (1 - inputs.marginalTaxRate);
  const reinvestmentReturn = cashOutAmount * inputs.sponsorReinvestmentIRR;
  const netBenefit = reinvestmentReturn - extraInterestAfterTax;
  const meetsDSCR = inputs.newDSCR >= DSCR_FLOOR_FOR_CASHOUT;

  let verdict: RefiProceedsResult['verdict'];
  if (inputs.newDSCR < DSCR_FLOOR_FOR_ANY_REFI) {
    verdict = 'do-not-refi';
  } else if (cashOutAmount > 0 && netBenefit > 0 && meetsDSCR) {
    verdict = 'cash-out';
  } else {
    verdict = 'rate-and-term';
  }
  return {
    verdict,
    cashOutAmount,
    extraInterestCostAnnual: extraInterestAnnual,
    extraInterestCostAfterTax: extraInterestAfterTax,
    reinvestmentReturnAnnual: reinvestmentReturn,
    netBenefitAnnual: netBenefit,
    meetsDSCR,
  };
}
