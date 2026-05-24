/**
 * deductible-optimizer — per-incident vs aggregate based on GAV.
 *
 * Per Marsh 2024 deductible-tuning study:
 *   - Per-incident $10k-$25k optimum for owners < $50M GAV
 *   - Aggregate deductibles best for portfolios > $200M GAV
 *   - SIR only with cash > 3× expected losses
 */

export interface DeductibleInput {
  readonly gavUsd: number;
  readonly cashReserveUsd: number;
  readonly expectedAnnualLossesUsd: number;
  readonly currentDeductibleUsd: number;
}

export interface DeductibleAdvice {
  readonly recommendedKind: 'per-incident' | 'aggregate' | 'sir';
  readonly recommendedAmountUsd: number;
  readonly canAffordSir: boolean;
  readonly rationale: string;
  readonly citation: string;
}

export function optimizeDeductible(input: DeductibleInput): DeductibleAdvice {
  const sirSafe = input.cashReserveUsd >= input.expectedAnnualLossesUsd * 3;
  if (input.gavUsd < 50_000_000) {
    return {
      recommendedKind: 'per-incident',
      recommendedAmountUsd: 15_000,
      canAffordSir: false,
      rationale: 'Sub-$50M GAV: per-incident $10k-$25k optimum per Marsh 2024 tuning study.',
      citation: 'Marsh Global Insurance Market 2024 Q4',
    };
  }
  if (input.gavUsd >= 200_000_000) {
    if (sirSafe) {
      return {
        recommendedKind: 'sir',
        recommendedAmountUsd: Math.min(500_000, input.expectedAnnualLossesUsd),
        canAffordSir: true,
        rationale: 'Large portfolio + 3× cash buffer: SIR cuts premium 12-18% per Marsh 2024.',
        citation: 'Marsh Global Insurance Market 2024 Q4',
      };
    }
    return {
      recommendedKind: 'aggregate',
      recommendedAmountUsd: 250_000,
      canAffordSir: false,
      rationale: 'Large portfolio without SIR buffer: aggregate deductible smooths volatility.',
      citation: 'Marsh Global Insurance Market 2024 Q4',
    };
  }
  return {
    recommendedKind: 'per-incident',
    recommendedAmountUsd: 50_000,
    canAffordSir: sirSafe,
    rationale: 'Mid-cap GAV: per-incident $50k balances retention savings with volatility.',
    citation: 'Marsh Global Insurance Market 2024 Q4',
  };
}
