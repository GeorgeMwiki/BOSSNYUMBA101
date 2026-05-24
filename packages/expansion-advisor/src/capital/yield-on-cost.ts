/**
 * Yield-on-cost — stabilised NOI ÷ total project cost.
 *
 * Institutional UW spread thresholds (2026):
 *   - residential: market cap-rate + 1.25%
 *   - office/retail/industrial: market cap-rate + 1.50%
 * Spread can be passed in for non-standard product.
 */

export interface YieldOnCostInputs {
  readonly stabilisedNOI: number;
  readonly totalCost: number;
  readonly marketCapRate: number;
  readonly requiredSpread?: number;
}

export interface YieldOnCostResult {
  readonly yieldOnCost: number;
  readonly spread: number;
  readonly meetsThreshold: boolean;
  readonly threshold: number;
}

export function yieldOnCost(input: YieldOnCostInputs): YieldOnCostResult {
  if (input.totalCost <= 0) {
    throw new Error('yieldOnCost: totalCost must be positive');
  }
  const required = input.requiredSpread ?? 0.0125;
  const yoc = input.stabilisedNOI / input.totalCost;
  const spread = yoc - input.marketCapRate;
  const threshold = input.marketCapRate + required;
  return {
    yieldOnCost: yoc,
    spread,
    meetsThreshold: yoc >= threshold,
    threshold,
  };
}
