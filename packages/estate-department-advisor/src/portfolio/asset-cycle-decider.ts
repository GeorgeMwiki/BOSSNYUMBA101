/**
 * asset-cycle-decider — refurbish / hold / sell / convert decision matrix.
 *
 * Decision rules (veteran-director defaults):
 *   - Sell if forwardIRR < holdingHurdle - 200 bps AND
 *     marketCapRate <= entryCapRate - 50 bps (cap-rate compression
 *     realised) AND no tax-basis trap.
 *   - Refurbish if incrementalRefurbIRR >= holdingHurdle + 300 bps
 *     AND payback <= 5 yrs.
 *   - Convert if bestAlternativeUseIRR >= holdingIRR + 500 bps
 *     AND zoningProbability >= 0.5.
 *   - Hold otherwise — the *default* in absence of signal.
 *
 * Sources: ULI Emerging Trends 2025, JLL Cost-of-Inertia 2023.
 */

import type { PropertySnapshot, TenantId } from '../types.js';

export type AssetCycleAction = 'sell' | 'refurbish' | 'hold' | 'convert';

export interface AssetCycleInput {
  readonly tenantId: TenantId;
  readonly property: PropertySnapshot;
  readonly holdingHurdleIrr: number; // e.g. 0.12
  readonly forwardHoldIrr: number; // expected IRR if held
  readonly refurbishIncrementalIrr: number;
  readonly refurbishPaybackYears: number;
  readonly bestConversionIrr: number;
  readonly conversionZoningProbability: number; // 0..1
  readonly hasTaxBasisTrap: boolean;
}

export interface AssetCycleDecision {
  readonly tenantId: TenantId;
  readonly propertyId: string;
  readonly action: AssetCycleAction;
  readonly rationale: string;
  readonly citation: string;
  readonly drivers: ReadonlyArray<string>;
}

const SELL_HURDLE_GAP_BPS = 0.02; // 200 bps
const REFURB_HURDLE_GAP_BPS = 0.03; // 300 bps
const CONVERT_HURDLE_GAP_BPS = 0.05; // 500 bps
const CAP_RATE_COMPRESSION_BPS = 0.005; // 50 bps
const REFURB_PAYBACK_MAX_YEARS = 5;
const CONVERT_ZONING_PROB_MIN = 0.5;

export function decideAssetCycle(input: AssetCycleInput): AssetCycleDecision {
  const drivers: string[] = [];

  // Sell test
  const sellIrrSignal = input.forwardHoldIrr < input.holdingHurdleIrr - SELL_HURDLE_GAP_BPS;
  const capCompressionRealised =
    input.property.currentMarketCapRate <=
    input.property.entryCapRate - CAP_RATE_COMPRESSION_BPS;
  if (sellIrrSignal && capCompressionRealised && !input.hasTaxBasisTrap) {
    drivers.push(
      `forward IRR ${(input.forwardHoldIrr * 100).toFixed(1)}% < hurdle ${(input.holdingHurdleIrr * 100).toFixed(1)}% − 200 bps`,
    );
    drivers.push(
      `cap-rate compression realised (entry ${(input.property.entryCapRate * 100).toFixed(2)}% → market ${(input.property.currentMarketCapRate * 100).toFixed(2)}%)`,
    );
    return {
      tenantId: input.tenantId,
      propertyId: input.property.propertyId,
      action: 'sell',
      rationale:
        'Forward IRR fails hurdle by > 200 bps and cap-rate compression has been realised — sell to lock the upside.',
      citation: 'ULI Emerging Trends 2025 + JLL Cost-of-Inertia 2023',
      drivers,
    };
  }

  // Convert test (next-best alternative use)
  const convertHurdle = input.holdingHurdleIrr + CONVERT_HURDLE_GAP_BPS;
  if (
    input.bestConversionIrr >= convertHurdle &&
    input.conversionZoningProbability >= CONVERT_ZONING_PROB_MIN
  ) {
    drivers.push(
      `conversion IRR ${(input.bestConversionIrr * 100).toFixed(1)}% ≥ hurdle + 500 bps`,
    );
    drivers.push(`zoning prob ${(input.conversionZoningProbability * 100).toFixed(0)}%`);
    return {
      tenantId: input.tenantId,
      propertyId: input.property.propertyId,
      action: 'convert',
      rationale:
        'Alternative-use IRR clears hurdle by 500+ bps with a credible zoning path — re-positioning maximises value.',
      citation: 'ULI Emerging Trends 2025',
      drivers,
    };
  }

  // Refurbish test
  const refurbHurdle = input.holdingHurdleIrr + REFURB_HURDLE_GAP_BPS;
  if (
    input.refurbishIncrementalIrr >= refurbHurdle &&
    input.refurbishPaybackYears <= REFURB_PAYBACK_MAX_YEARS
  ) {
    drivers.push(
      `refurb IRR ${(input.refurbishIncrementalIrr * 100).toFixed(1)}% ≥ hurdle + 300 bps`,
    );
    drivers.push(`payback ${input.refurbishPaybackYears.toFixed(1)} yrs ≤ 5`);
    return {
      tenantId: input.tenantId,
      propertyId: input.property.propertyId,
      action: 'refurbish',
      rationale:
        'Incremental refurb IRR clears hurdle + 300 bps with a 5-year payback — accretive value-add play.',
      citation: 'ULI Emerging Trends 2025',
      drivers,
    };
  }

  // Default: hold
  drivers.push('no decisive signal — veteran-director default is hold');
  return {
    tenantId: input.tenantId,
    propertyId: input.property.propertyId,
    action: 'hold',
    rationale:
      'No signal clears the sell / convert / refurbish thresholds — holding preserves optionality.',
    citation: 'ULI Emerging Trends 2025',
    drivers,
  };
}

export const __test__ = {
  SELL_HURDLE_GAP_BPS,
  REFURB_HURDLE_GAP_BPS,
  CONVERT_HURDLE_GAP_BPS,
  CAP_RATE_COMPRESSION_BPS,
  REFURB_PAYBACK_MAX_YEARS,
  CONVERT_ZONING_PROB_MIN,
};
