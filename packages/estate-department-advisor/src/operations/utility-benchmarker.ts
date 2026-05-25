/**
 * utility-benchmarker — ENERGY STAR + NABERS + GRESB-O.
 *
 * Sources:
 *   - ENERGY STAR Portfolio Manager 2024 (US/CA)
 *   - NABERS office rating 2024 (AU; transferable to office globally)
 *   - GRESB-O 2024 (RE ESG)
 */

import type { AssetClass, Recommendation, TenantId } from '../types.js';

export interface UtilityInput {
  readonly tenantId: TenantId;
  readonly assetClass: AssetClass;
  readonly siteEuiKbtuPerSfYear: number;
  readonly waterGalPerSfYear: number;
  readonly energyStarScore?: number; // 1..100
  readonly nabersStars?: number; // 0..6
}

export interface UtilityReport {
  readonly tenantId: TenantId;
  readonly energyPercentile: 'P25' | 'P50' | 'P75' | 'below-P75';
  readonly waterPercentile: 'P25' | 'P50' | 'below-P50';
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly citations: ReadonlyArray<string>;
}

// Office EUI bands (kBtu/SF·yr) per ENERGY STAR Portfolio Manager 2024.
const OFFICE_EUI = { p25: 55, p50: 75, p75: 95 } as const;
const MF_EUI = { p25: 40, p50: 55, p75: 75 } as const;
const RETAIL_EUI = { p25: 50, p50: 70, p75: 90 } as const;
const INDUSTRIAL_EUI = { p25: 30, p50: 50, p75: 75 } as const;
const DEFAULT_EUI = { p25: 50, p50: 70, p75: 90 } as const;

// Water UI (gal/SF·yr) — multifamily P25 per ENERGY STAR.
const WATER_MF = { p25: 50, p50: 75 } as const;
const WATER_OFFICE = { p25: 12, p50: 18 } as const;
const WATER_DEFAULT = { p25: 20, p50: 35 } as const;

function euiBand(klass: AssetClass): { p25: number; p50: number; p75: number } {
  switch (klass) {
    case 'office':
      return OFFICE_EUI;
    case 'multifamily':
      return MF_EUI;
    case 'retail':
      return RETAIL_EUI;
    case 'industrial':
      return INDUSTRIAL_EUI;
    default:
      return DEFAULT_EUI;
  }
}

function waterBand(klass: AssetClass): { p25: number; p50: number } {
  switch (klass) {
    case 'multifamily':
      return WATER_MF;
    case 'office':
      return WATER_OFFICE;
    default:
      return WATER_DEFAULT;
  }
}

export function benchmarkUtilities(input: UtilityInput): UtilityReport {
  const eui = euiBand(input.assetClass);
  const wat = waterBand(input.assetClass);
  const recs: Recommendation[] = [];

  let energyPercentile: 'P25' | 'P50' | 'P75' | 'below-P75';
  if (input.siteEuiKbtuPerSfYear <= eui.p25) energyPercentile = 'P25';
  else if (input.siteEuiKbtuPerSfYear <= eui.p50) energyPercentile = 'P50';
  else if (input.siteEuiKbtuPerSfYear <= eui.p75) energyPercentile = 'P75';
  else energyPercentile = 'below-P75';

  if (energyPercentile === 'below-P75') {
    recs.push({
      id: 'util.energy.poor',
      kind: 'operations',
      severity: 'high',
      headline: `Site EUI ${input.siteEuiKbtuPerSfYear.toFixed(0)} kBtu/SF·yr exceeds ENERGY STAR P75 (${eui.p75})`,
      rationale: `Below-P75 buildings are top targets for retro-commissioning per ENERGY STAR Portfolio Manager — typical 10-20% energy savings.`,
      citation: 'ENERGY STAR Portfolio Manager 2024',
      strategicScore: 0.6,
      urgencyScore: 0.55,
      composite: 0.45 * 0.6 + 0.25 * 0.55,
    });
  }

  if (input.energyStarScore !== undefined && input.energyStarScore < 50) {
    recs.push({
      id: 'util.estar.low',
      kind: 'operations',
      severity: 'medium',
      headline: `ENERGY STAR score ${input.energyStarScore} < 50 — bottom half nationally`,
      rationale: `Score < 50 disqualifies most ESG credit facilities; investment-grade tenants increasingly require ≥ 75.`,
      citation: 'ENERGY STAR + GRESB-O 2024',
      strategicScore: 0.65,
      urgencyScore: 0.45,
      composite: 0.45 * 0.65 + 0.25 * 0.45,
    });
  }

  if (input.nabersStars !== undefined && input.nabersStars < 4.5) {
    recs.push({
      id: 'util.nabers.low',
      kind: 'operations',
      severity: 'medium',
      headline: `NABERS ${input.nabersStars.toFixed(1)} stars < 4.5 — below market median`,
      rationale: `4.5+ stars is NABERS market median 2024; below indicates HVAC inefficiency or BMS calibration drift.`,
      citation: 'NABERS Office Rating 2024',
      strategicScore: 0.55,
      urgencyScore: 0.4,
      composite: 0.45 * 0.55 + 0.25 * 0.4,
    });
  }

  let waterPercentile: 'P25' | 'P50' | 'below-P50';
  if (input.waterGalPerSfYear <= wat.p25) waterPercentile = 'P25';
  else if (input.waterGalPerSfYear <= wat.p50) waterPercentile = 'P50';
  else waterPercentile = 'below-P50';

  if (waterPercentile === 'below-P50') {
    recs.push({
      id: 'util.water.high',
      kind: 'operations',
      severity: 'medium',
      headline: `Water ${input.waterGalPerSfYear.toFixed(0)} gal/SF·yr exceeds P50 (${wat.p50})`,
      rationale: `Above P50 typically signals leaks or outdated fixtures — sub-meter audit per ENERGY STAR water-benchmarking guidance.`,
      citation: 'ENERGY STAR Water Benchmarking 2024',
      strategicScore: 0.5,
      urgencyScore: 0.45,
      composite: 0.45 * 0.5 + 0.25 * 0.45,
    });
  }

  return {
    tenantId: input.tenantId,
    energyPercentile,
    waterPercentile,
    recommendations: recs,
    citations: ['ENERGY STAR Portfolio Manager 2024', 'NABERS 2024', 'GRESB-O 2024'],
  };
}

export const __test__ = { euiBand, waterBand, OFFICE_EUI, MF_EUI, WATER_MF };
