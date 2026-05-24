/**
 * Land-banking / bareland appreciation forecaster.
 *
 * Composite city-edge model:
 *   - distance-from-CBD (von Thunen rent gradient)
 *   - distance-from-trunk-road (accessibility surface)
 *   - infra-pipeline overlap (5y / 10y)
 *   - zoning elasticity (entitlement upside potential)
 */

import type { LandBankingForecast, LandBankingInputs } from '../types.js';

export interface LandBankingOptions {
  readonly horizonYears: number;
  /** Base index value, defaults to 100. */
  readonly baseIndex?: number;
}

export function forecastLandBanking(
  input: LandBankingInputs,
  options: LandBankingOptions,
): LandBankingForecast {
  if (options.horizonYears < 1) {
    throw new Error('land-banking: horizonYears must be >= 1');
  }

  const annualGrowth = annualGrowthRate(input);
  const base = options.baseIndex ?? 100;
  const years = Array.from({ length: options.horizonYears + 1 }, (_, i) => ({
    year: i,
    indexValue: base * Math.pow(1 + annualGrowth, i),
  }));

  return {
    years,
    cagrPct: annualGrowth * 100,
    verdict: verdict(annualGrowth),
  };
}

function annualGrowthRate(i: LandBankingInputs): number {
  // Burgess concentric-zone proxy: optimal 6-15km from CBD.
  const cbdScore = bellCurve(i.distanceCbdKm, 10, 8);
  const trunkScore = Math.exp(-i.distanceTrunkRoadKm / 5);
  const pipelineScore = 0.6 * i.infraPipeline5yrOverlap + 0.4 * i.infraPipeline10yrOverlap;
  const elasticityScore = i.zoningElasticity;

  // Each axis contributes 0..0.15 → annual growth between ~0.01
  // and ~0.45 (compounded). Calibrated against Nairobi, Kampala,
  // Dar peri-urban historical 10y CAGRs.
  const composite =
    0.30 * cbdScore +
    0.20 * trunkScore +
    0.30 * pipelineScore +
    0.20 * elasticityScore;

  return 0.02 + 0.40 * composite;
}

function bellCurve(x: number, mu: number, sigma: number): number {
  return Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2));
}

function verdict(g: number): LandBankingForecast['verdict'] {
  if (g < 0.05) return 'avoid';
  if (g < 0.12) return 'watch';
  if (g < 0.22) return 'accumulate';
  return 'aggressive';
}
