/**
 * catastrophe-modeler — RMS / AIR Worldwide style stub.
 *
 * Returns placeholder exposures for EA jurisdictions until live RMS
 * RiskLink or AIR Touchstone integration is wired. Useful for
 * narrative + scope clarity in the department-health report.
 */

import type { Jurisdiction, PortfolioSnapshot } from '../types.js';

export interface CatastropheExposure {
  readonly perilName: string;
  readonly probableMaxLossUsd: number;
  readonly returnPeriodYears: number;
  readonly source: string;
}

const PERIL_TABLE: Readonly<Record<Jurisdiction, ReadonlyArray<CatastropheExposure>>> = {
  KE: [
    { perilName: 'Riverine flood (Nairobi)', probableMaxLossUsd: 0, returnPeriodYears: 100, source: 'RMS Africa flood model (placeholder)' },
    { perilName: 'East-African Rift seismic', probableMaxLossUsd: 0, returnPeriodYears: 250, source: 'AIR Worldwide EA seismic (placeholder)' },
    { perilName: 'Post-election civil unrest', probableMaxLossUsd: 0, returnPeriodYears: 5, source: 'Marsh Africa political-risk (placeholder)' },
  ],
  TZ: [
    { perilName: 'Coastal flooding (Dar)', probableMaxLossUsd: 0, returnPeriodYears: 100, source: 'RMS Africa flood (placeholder)' },
    { perilName: 'East-African Rift seismic', probableMaxLossUsd: 0, returnPeriodYears: 250, source: 'AIR Worldwide (placeholder)' },
  ],
  UG: [
    { perilName: 'Lake flooding', probableMaxLossUsd: 0, returnPeriodYears: 100, source: 'placeholder' },
    { perilName: 'East-African Rift seismic', probableMaxLossUsd: 0, returnPeriodYears: 250, source: 'placeholder' },
  ],
  NG: [
    { perilName: 'Lagos coastal flooding', probableMaxLossUsd: 0, returnPeriodYears: 50, source: 'Estate Intel (placeholder)' },
    { perilName: 'Civil unrest', probableMaxLossUsd: 0, returnPeriodYears: 5, source: 'placeholder' },
  ],
  RW: [
    { perilName: 'East-African Rift seismic', probableMaxLossUsd: 0, returnPeriodYears: 250, source: 'placeholder' },
  ],
  ZA: [
    { perilName: 'Drought', probableMaxLossUsd: 0, returnPeriodYears: 30, source: 'SA Weather Service (placeholder)' },
    { perilName: 'Civil unrest', probableMaxLossUsd: 0, returnPeriodYears: 10, source: 'placeholder' },
  ],
  US: [
    { perilName: 'Generic CAT', probableMaxLossUsd: 0, returnPeriodYears: 100, source: 'RMS RiskLink (placeholder)' },
  ],
};

export function modelCatastrophe(portfolio: PortfolioSnapshot): ReadonlyArray<CatastropheExposure> {
  const jurisdictions = new Set(portfolio.properties.map((p) => p.jurisdiction));
  const gavByJurisdiction = new Map<Jurisdiction, number>();
  for (const p of portfolio.properties) {
    gavByJurisdiction.set(p.jurisdiction, (gavByJurisdiction.get(p.jurisdiction) ?? 0) + p.marketValueUsd);
  }
  const out: CatastropheExposure[] = [];
  for (const j of jurisdictions) {
    const table = PERIL_TABLE[j];
    if (!table) continue;
    const exposure = gavByJurisdiction.get(j) ?? 0;
    for (const peril of table) {
      // Stub PML = 5% of jurisdiction GAV at 100-yr peril, scaled by 1/sqrt(rp).
      const pml = exposure * 0.05 * Math.sqrt(100 / Math.max(peril.returnPeriodYears, 1));
      out.push({ ...peril, probableMaxLossUsd: Math.round(pml) });
    }
  }
  return out;
}

export const __test__ = { PERIL_TABLE };
