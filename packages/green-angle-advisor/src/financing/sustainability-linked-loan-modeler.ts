/**
 * Sustainability-Linked Loan (SLL) modeler.
 *
 * Per LMA/APLMA/LSTA SLLP (May 2025 update):
 *   - KPI must be MATERIAL and externally observable
 *   - SPT must be AMBITIOUS — calibrated by ICMA / SBTi / TPT
 *   - Margin step-down typ. 5 - 15 bps when SPT met
 *   - Symmetric step-up if missed
 *
 * Returns a deterministic SLL term-sheet projection.
 *
 * Pure. No I/O.
 */

export interface SllInputs {
  /** Principal in USD millions. */
  readonly principalUsdMillions: number;
  /** Base margin in bps (e.g. 300 for SOFR + 300). */
  readonly baseMarginBps: number;
  /** Step-down bps if SPT met (positive number). */
  readonly stepDownBps: number;
  /** Step-up bps if SPT missed (positive number). */
  readonly stepUpBps: number;
  /** Probability the SPT is met (0-1). */
  readonly pSptMet: number;
  /** Tenor in years. */
  readonly tenorYears: number;
}

export interface SllProjection {
  readonly principalUsdMillions: number;
  readonly baseMarginBps: number;
  readonly expectedMarginBps: number;
  readonly bestCaseMarginBps: number;
  readonly worstCaseMarginBps: number;
  readonly tenorYears: number;
  /** Expected interest savings vs. base over tenor in USD. */
  readonly expectedInterestSavingsUsd: number;
  /** Worst-case interest add-on USD. */
  readonly worstCaseInterestAddOnUsd: number;
}

export function modelSll(inputs: SllInputs): SllProjection {
  if (inputs.pSptMet < 0 || inputs.pSptMet > 1) {
    throw new Error('pSptMet must be in [0, 1]');
  }
  const expectedMargin =
    inputs.baseMarginBps -
    inputs.stepDownBps * inputs.pSptMet +
    inputs.stepUpBps * (1 - inputs.pSptMet);
  const bestCase = inputs.baseMarginBps - inputs.stepDownBps;
  const worstCase = inputs.baseMarginBps + inputs.stepUpBps;

  const principalUsd = inputs.principalUsdMillions * 1_000_000;
  const expectedSavings = ((inputs.baseMarginBps - expectedMargin) / 10_000) * principalUsd * inputs.tenorYears;
  const worstCaseAddOn = ((worstCase - inputs.baseMarginBps) / 10_000) * principalUsd * inputs.tenorYears;

  return {
    principalUsdMillions: inputs.principalUsdMillions,
    baseMarginBps: inputs.baseMarginBps,
    expectedMarginBps: Math.round(expectedMargin * 10) / 10,
    bestCaseMarginBps: bestCase,
    worstCaseMarginBps: worstCase,
    tenorYears: inputs.tenorYears,
    expectedInterestSavingsUsd: Math.round(expectedSavings),
    worstCaseInterestAddOnUsd: Math.round(worstCaseAddOn),
  };
}
