/**
 * Casualty + condemnation modeler — applies the industry-standard
 * "5% rule" with hard-dollar floor (USD 250 k) and ULI 2024
 * partial-condemnation guidance.
 */

import type { CasualtyCondemnationModel } from '../types.js';

export interface CasualtyConfigInputs {
  readonly purchasePrice: number;
  readonly hardDollarFloor?: number;
  readonly thresholdSharePctOverride?: number;
  readonly partialCondemnationRule?: CasualtyCondemnationModel['partialCondemnationRule'];
}

export function modelCasualtyCondemnation(
  inputs: CasualtyConfigInputs,
): CasualtyCondemnationModel {
  if (inputs.purchasePrice <= 0) {
    throw new Error('purchasePrice must be > 0');
  }
  const sharePct = inputs.thresholdSharePctOverride ?? 0.05;
  if (sharePct <= 0 || sharePct > 1) {
    throw new Error('thresholdSharePctOverride must be in (0, 1]');
  }
  const floor = inputs.hardDollarFloor ?? 250_000;
  const thresholdDollarShare = inputs.purchasePrice * sharePct;
  const thresholdDollar = Math.min(thresholdDollarShare, floor);

  return {
    thresholdSharePct: sharePct,
    thresholdDollar,
    buyerTerminationTrigger: true,
    insuranceProceedsCredit: true,
    partialCondemnationRule: inputs.partialCondemnationRule ?? 'buyer-elect',
  };
}

/**
 * Apply the model to a hypothetical loss; return whether buyer
 * may terminate.
 */
export function buyerMayTerminate(
  model: CasualtyCondemnationModel,
  lossDollar: number,
): boolean {
  return lossDollar > model.thresholdDollar;
}
