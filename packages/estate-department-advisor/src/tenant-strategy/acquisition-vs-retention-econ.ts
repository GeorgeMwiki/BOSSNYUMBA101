/**
 * acquisition-vs-retention-econ — CAC vs LTV per property type.
 *
 * Per NMHC Resident Survey 2024 + JTurner retention study.
 *
 * Industry rule: $1 retention spend = $4-$7 acquisition cost.
 * Break-even retention period: ~8.5 months of tenancy.
 */

import type { AssetClass, Recommendation, TenantId } from '../types.js';

export interface AcqRetentionInput {
  readonly tenantId: TenantId;
  readonly assetClass: AssetClass;
  readonly avgMonthlyRentUsd: number;
  readonly currentTurnoverRate: number; // 0..1 annual
  readonly currentAcquisitionCostPerUnitUsd: number;
  readonly currentRetentionSpendPerRenewalUsd: number;
}

export interface AcqRetentionReport {
  readonly tenantId: TenantId;
  readonly cac: number;
  readonly cacUpperBenchmark: number;
  readonly retentionBudgetUpperBenchmark: number;
  readonly retentionRoi: number; // multiple
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly citation: string;
}

const CAC_BANDS: Readonly<Record<AssetClass, [number, number]>> = {
  multifamily: [1_200, 2_500],
  office: [10_000, 35_000],
  retail: [8_000, 25_000],
  industrial: [12_000, 30_000],
  hotel: [50, 150],
  'mixed-use': [2_000, 6_000],
  land: [500, 1_500],
};

const RETENTION_BANDS: Readonly<Record<AssetClass, [number, number]>> = {
  multifamily: [500, 1_200],
  office: [3_000, 12_000],
  retail: [2_000, 8_000],
  industrial: [4_000, 10_000],
  hotel: [20, 80],
  'mixed-use': [800, 2_500],
  land: [200, 500],
};

export function analyzeAcqRetention(input: AcqRetentionInput): AcqRetentionReport {
  const cacBand = CAC_BANDS[input.assetClass];
  const retBand = RETENTION_BANDS[input.assetClass];
  const recs: Recommendation[] = [];
  const cacUpper = cacBand[1];
  const retUpper = retBand[1];
  // ROI multiple: NMHC heuristic $1 retention = $4-$7 acquisition.
  const roi = input.currentRetentionSpendPerRenewalUsd > 0
    ? input.currentAcquisitionCostPerUnitUsd / input.currentRetentionSpendPerRenewalUsd
    : 0;

  if (input.currentAcquisitionCostPerUnitUsd > cacUpper) {
    recs.push({
      id: 'acq.cac.high',
      kind: 'tenant-strategy',
      severity: 'high',
      headline: `CAC $${input.currentAcquisitionCostPerUnitUsd.toFixed(0)} > ${input.assetClass} P75 ($${cacUpper})`,
      rationale: `Acquisition spend exceeds NMHC P75 for ${input.assetClass}; shift budget to retention per JTurner $1=$4-7 rule.`,
      citation: 'NMHC Resident Survey 2024 + JTurner retention study',
      strategicScore: 0.7,
      urgencyScore: 0.55,
      composite: 0.45 * 0.7 + 0.25 * 0.55,
    });
  }
  if (input.currentRetentionSpendPerRenewalUsd < retBand[0]) {
    recs.push({
      id: 'ret.spend.low',
      kind: 'tenant-strategy',
      severity: 'medium',
      headline: `Retention spend $${input.currentRetentionSpendPerRenewalUsd.toFixed(0)} below ${input.assetClass} floor ($${retBand[0]})`,
      rationale: `Under-investment in retention costs 4-7× more in CAC per JTurner; double retention budget.`,
      citation: 'JTurner 2024 retention study',
      strategicScore: 0.65,
      urgencyScore: 0.5,
      composite: 0.45 * 0.65 + 0.25 * 0.5,
    });
  }
  if (input.currentTurnoverRate > 0.40) {
    recs.push({
      id: 'turnover.high',
      kind: 'tenant-strategy',
      severity: 'high',
      headline: `Turnover ${(input.currentTurnoverRate * 100).toFixed(0)}% — above 40% line`,
      rationale: `> 40% turnover destroys ~60 days of revenue per unit per NMHC 2024; root-cause retention review urgent.`,
      citation: 'NMHC Resident Survey 2024',
      strategicScore: 0.8,
      urgencyScore: 0.7,
      composite: 0.45 * 0.8 + 0.25 * 0.7,
    });
  }

  return {
    tenantId: input.tenantId,
    cac: input.currentAcquisitionCostPerUnitUsd,
    cacUpperBenchmark: cacUpper,
    retentionBudgetUpperBenchmark: retUpper,
    retentionRoi: roi,
    recommendations: recs,
    citation: 'NMHC Resident Survey 2024 + JTurner retention 2024',
  };
}

export const __test__ = { CAC_BANDS, RETENTION_BANDS };
