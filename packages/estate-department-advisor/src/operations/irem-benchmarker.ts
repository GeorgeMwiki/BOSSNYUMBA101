/**
 * irem-benchmarker — income/expense ratios vs IREM 2024 IEA peer.
 *
 * Source: IREM 2024 Income/Expense Analysis (Multifamily, US median).
 * EA-adjusted bands shift utility + R&M; vacancy retained from US.
 */

import type { PortfolioSnapshot, Recommendation, TenantId } from '../types.js';

export interface IremBenchmark {
  readonly oerTarget: number; // operating expense ratio (% of EGI)
  readonly oerCaution: number;
  readonly oerAction: number;
  readonly noiMarginTarget: number;
  readonly noiMarginCaution: number;
  readonly vacancyTarget: number;
  readonly vacancyCaution: number;
  readonly maintPerUnitTarget: number; // USD/unit/yr
  readonly maintPerUnitCaution: number;
  readonly source: string;
}

export const IREM_MULTIFAMILY_2024: IremBenchmark = {
  oerTarget: 0.38,
  oerCaution: 0.45,
  oerAction: 0.55,
  noiMarginTarget: 0.58,
  noiMarginCaution: 0.50,
  vacancyTarget: 0.07,
  vacancyCaution: 0.10,
  maintPerUnitTarget: 1150,
  maintPerUnitCaution: 1650,
  source: 'IREM 2024 Income/Expense Analysis — Multifamily US median',
};

export interface IremReport {
  readonly tenantId: TenantId;
  readonly operatingExpenseRatio: number;
  readonly noiMargin: number;
  readonly vacancyRate: number;
  readonly maintenancePerUnit: number;
  readonly percentileOer: 'P25' | 'P50' | 'P75' | 'P90';
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly citation: string;
}

function classifyPercentile(actual: number, target: number, caution: number, action: number): 'P25' | 'P50' | 'P75' | 'P90' {
  if (actual <= target) return 'P25';
  if (actual <= caution) return 'P50';
  if (actual <= action) return 'P75';
  return 'P90';
}

export function benchmarkIrem(portfolio: PortfolioSnapshot): IremReport {
  const mfProps = portfolio.properties.filter((p) => p.assetClass === 'multifamily');
  if (mfProps.length === 0) {
    return {
      tenantId: portfolio.tenantId,
      operatingExpenseRatio: 0,
      noiMargin: 0,
      vacancyRate: 0,
      maintenancePerUnit: 0,
      percentileOer: 'P50',
      recommendations: [],
      citation: IREM_MULTIFAMILY_2024.source,
    };
  }
  const revenue = mfProps.reduce((s, p) => s + p.annualRevenueUsd, 0);
  const opex = mfProps.reduce((s, p) => s + p.annualOpexUsd, 0);
  const noi = mfProps.reduce((s, p) => s + p.annualNoiUsd, 0);
  const doors = mfProps.reduce((s, p) => s + p.doors, 0);
  const oer = revenue > 0 ? opex / revenue : 0;
  const noiMargin = revenue > 0 ? noi / revenue : 0;
  const occ = mfProps.reduce((s, p) => s + p.occupancyRate * p.doors, 0) / Math.max(doors, 1);
  const vacancy = 1 - occ;
  // Heuristic split: R&M ≈ 22 % of opex (IREM 2024 mean).
  const maintPerUnit = doors > 0 ? (opex * 0.22) / doors : 0;

  const recs: Recommendation[] = [];
  if (oer > IREM_MULTIFAMILY_2024.oerAction) {
    recs.push({
      id: 'irem.oer.action',
      kind: 'operations',
      severity: 'critical',
      headline: `OER ${(oer * 100).toFixed(0)}% breaches action threshold (${(IREM_MULTIFAMILY_2024.oerAction * 100).toFixed(0)}%)`,
      rationale: `IREM 2024 IEA places > 55% OER in the action band; immediate opex audit warranted.`,
      citation: IREM_MULTIFAMILY_2024.source,
      strategicScore: 0.85,
      urgencyScore: 0.85,
      composite: 0.45 * 0.85 + 0.25 * 0.85,
    });
  } else if (oer > IREM_MULTIFAMILY_2024.oerCaution) {
    recs.push({
      id: 'irem.oer.caution',
      kind: 'operations',
      severity: 'high',
      headline: `OER ${(oer * 100).toFixed(0)}% in caution band`,
      rationale: `Above 45% OER per IREM 2024 IEA caution threshold — line-item review of top 3 opex categories.`,
      citation: IREM_MULTIFAMILY_2024.source,
      strategicScore: 0.7,
      urgencyScore: 0.55,
      composite: 0.45 * 0.7 + 0.25 * 0.55,
    });
  }
  if (vacancy > IREM_MULTIFAMILY_2024.vacancyCaution) {
    recs.push({
      id: 'irem.vacancy.high',
      kind: 'operations',
      severity: 'high',
      headline: `Vacancy ${(vacancy * 100).toFixed(0)}% exceeds caution (${(IREM_MULTIFAMILY_2024.vacancyCaution * 100).toFixed(0)}%)`,
      rationale: `IREM peer P75 sits at the caution threshold — pricing + lease-up campaign required.`,
      citation: IREM_MULTIFAMILY_2024.source,
      strategicScore: 0.8,
      urgencyScore: 0.7,
      composite: 0.45 * 0.8 + 0.25 * 0.7,
    });
  }
  if (maintPerUnit > IREM_MULTIFAMILY_2024.maintPerUnitCaution) {
    recs.push({
      id: 'irem.maint.high',
      kind: 'operations',
      severity: 'medium',
      headline: `Maintenance $${maintPerUnit.toFixed(0)}/unit exceeds peer caution`,
      rationale: `Maintenance per unit above IREM 2024 P75; deferred-maintenance backlog or vendor-pricing drift.`,
      citation: IREM_MULTIFAMILY_2024.source,
      strategicScore: 0.55,
      urgencyScore: 0.5,
      composite: 0.45 * 0.55 + 0.25 * 0.5,
    });
  }

  return {
    tenantId: portfolio.tenantId,
    operatingExpenseRatio: oer,
    noiMargin,
    vacancyRate: vacancy,
    maintenancePerUnit: maintPerUnit,
    percentileOer: classifyPercentile(
      oer,
      IREM_MULTIFAMILY_2024.oerTarget,
      IREM_MULTIFAMILY_2024.oerCaution,
      IREM_MULTIFAMILY_2024.oerAction,
    ),
    recommendations: recs,
    citation: IREM_MULTIFAMILY_2024.source,
  };
}

export const __test__ = { classifyPercentile };
