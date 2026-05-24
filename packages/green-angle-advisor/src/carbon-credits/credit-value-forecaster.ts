/**
 * Credit-value forecaster — USD/tCO2e per registry / project type.
 *
 * 2026 spot reference (illustrative; calibrated to public mid-May 2026
 * Q1 reports and Ecosystem Marketplace tracker):
 *
 *   - VCS REDD+:                       USD 4.5  (down from 7.2 peak)
 *   - VCS AR/IFM (mature corridor):    USD 18
 *   - VCS Blue Carbon (VM0033):        USD 35
 *   - VCS Biochar (VM0044):            USD 130
 *   - VCS Modal shift (VMR0006):       USD 28
 *   - GS LUF AR:                       USD 19
 *   - GS Cookstove (CDM-replacement):  USD 8
 *   - PACM (early corresponding adj):  USD 22
 *   - ACR AdvRef:                      USD 12
 *   - Puro Biochar (durable):          USD 145
 *
 * Forward curve: ICVCM Core-Carbon-Principles uplift to durable removals
 * compounds at +6% real per year for high-integrity supply.
 *
 * Pure. No I/O.
 */

import type { CarbonMethodology } from '../types.js';

interface ValuePoint {
  readonly spotUsdPerTon: number;
  readonly forwardGrowthPct: number; // annual real growth
}

const VALUES_2026: Readonly<Record<string, ValuePoint>> = {
  'VCS-VM0007': { spotUsdPerTon: 4.5, forwardGrowthPct: 3 },
  'VCS-VM0009': { spotUsdPerTon: 6.5, forwardGrowthPct: 3 },
  'VCS-VM0033': { spotUsdPerTon: 35, forwardGrowthPct: 6 },
  'VCS-VM0035': { spotUsdPerTon: 33, forwardGrowthPct: 6 },
  'VCS-VM0042': { spotUsdPerTon: 22, forwardGrowthPct: 5 },
  'VCS-VM0044': { spotUsdPerTon: 130, forwardGrowthPct: 4 },
  'VCS-VM0047': { spotUsdPerTon: 18, forwardGrowthPct: 4 },
  'VCS-VM0048': { spotUsdPerTon: 7, forwardGrowthPct: 3 },
  'VCS-VMR0006': { spotUsdPerTon: 28, forwardGrowthPct: 5 },
  'GS-LUF-AR': { spotUsdPerTon: 19, forwardGrowthPct: 4 },
  'GS-EE-Cookstove': { spotUsdPerTon: 8, forwardGrowthPct: 2 },
  'GS-RE-SmallHydro': { spotUsdPerTon: 5, forwardGrowthPct: 1 },
  'PACM-Removals': { spotUsdPerTon: 22, forwardGrowthPct: 8 },
  'PACM-Avoidance': { spotUsdPerTon: 15, forwardGrowthPct: 4 },
  'ACR-AdvRef': { spotUsdPerTon: 12, forwardGrowthPct: 3 },
  'Puro-Biochar': { spotUsdPerTon: 145, forwardGrowthPct: 4 },
};

const DEFAULT_VALUE: ValuePoint = { spotUsdPerTon: 10, forwardGrowthPct: 2 };

export interface CreditValueForecast {
  readonly methodologyId: string;
  readonly registry: string;
  readonly spotUsdPerTon: number;
  /** USD/tCO2e averaged over forecast horizon. */
  readonly forwardAverageUsdPerTon: number;
  readonly forwardYearHorizon: number;
}

export function forecastCreditValue(
  methodology: CarbonMethodology,
  yearsForward: number,
): CreditValueForecast {
  const v = VALUES_2026[methodology.id] ?? DEFAULT_VALUE;
  let sum = 0;
  for (let y = 0; y < yearsForward; y++) {
    sum += v.spotUsdPerTon * Math.pow(1 + v.forwardGrowthPct / 100, y);
  }
  const avg = yearsForward > 0 ? sum / yearsForward : v.spotUsdPerTon;
  return {
    methodologyId: methodology.id,
    registry: methodology.registry,
    spotUsdPerTon: v.spotUsdPerTon,
    forwardAverageUsdPerTon: Math.round(avg * 100) / 100,
    forwardYearHorizon: yearsForward,
  };
}
