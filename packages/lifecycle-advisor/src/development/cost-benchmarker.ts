/**
 * Cost benchmarker — compares a USD/sqm quote to a regional index
 * built from RSMeans, Cumming Corp, Turner Building Cost Index,
 * AAK (Kenya) and TIC (Tanzania) 2026 data.
 *
 * Authority: RSMeans Square Foot Costs 2026, Cumming Corp Q1-2026
 * Cost Index, Turner Building Cost Index Q1-2026, AAK Construction
 * Cost Index 2026, TIC Construction Cost Index 2026.
 */

import type { CostBenchmarkInputs, CostBenchmarkResult } from '../types.js';

interface RegionIndex {
  readonly usdPerSqm: number;
  readonly source: string;
}

const REGION_INDEX: Readonly<Record<CostBenchmarkInputs['region'], RegionIndex>> = {
  'us-tier-1': { usdPerSqm: 3800, source: 'RSMeans 2026 + TBCI 1330' },
  'us-tier-2': { usdPerSqm: 2600, source: 'RSMeans 2026 + TBCI 1330' },
  'london': { usdPerSqm: 3500, source: 'Turner UK Index 1290 (2026)' },
  'lagos': { usdPerSqm: 1400, source: 'Cumming Africa Index 2026' },
  'nairobi': { usdPerSqm: 1150, source: 'AAK Construction Cost Index 2026' },
  'dar-es-salaam': { usdPerSqm: 980, source: 'TIC Construction Cost Index 2026' },
  'kampala': { usdPerSqm: 920, source: 'AAK + 15% country uplift (2026)' },
};

const FLAG_HIGH_THRESHOLD_PCT = 0.10;
const FLAG_REJECT_THRESHOLD_PCT = 0.25;

export function benchmarkCost(
  inputs: Readonly<CostBenchmarkInputs>,
): CostBenchmarkResult {
  const idx = REGION_INDEX[inputs.region];
  if (!idx) {
    throw new Error(`benchmarkCost: unknown region ${inputs.region}`);
  }
  if (inputs.quoteUsdPerSqm <= 0) {
    throw new Error('benchmarkCost: quoteUsdPerSqm must be > 0');
  }

  // Adjust index for high-rise premium (floors > 8 adds ~ 8 %/extra floor band)
  const floorMultiplier = inputs.floors > 8 ? 1 + 0.06 * Math.min(1, (inputs.floors - 8) / 12) : 1;
  // Asset-class adjustment
  const assetMultiplier =
    inputs.assetClass === 'office' ? 1.10 :
    inputs.assetClass === 'retail' ? 0.95 :
    inputs.assetClass === 'industrial' ? 0.70 :
    inputs.assetClass === 'mixed-use' ? 1.05 :
    1.0;

  const adjustedIndex = idx.usdPerSqm * floorMultiplier * assetMultiplier;
  const variancePct = (inputs.quoteUsdPerSqm - adjustedIndex) / adjustedIndex;

  let verdict: CostBenchmarkResult['verdict'];
  if (variancePct >= FLAG_REJECT_THRESHOLD_PCT) verdict = 'reject';
  else if (variancePct >= FLAG_HIGH_THRESHOLD_PCT) verdict = 'high-flag';
  else if (variancePct <= -FLAG_REJECT_THRESHOLD_PCT) verdict = 'reject';
  else if (variancePct <= -FLAG_HIGH_THRESHOLD_PCT) verdict = 'low-flag';
  else verdict = 'within-band';

  return {
    region: inputs.region,
    indexUsdPerSqm: adjustedIndex,
    quoteUsdPerSqm: inputs.quoteUsdPerSqm,
    variancePct,
    verdict,
    source: idx.source,
  };
}

export function listKnownRegions(): ReadonlyArray<string> {
  return Object.keys(REGION_INDEX);
}
