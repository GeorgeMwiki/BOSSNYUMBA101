/**
 * Comparable-sales triangulator — CBRE / Cushman / JLL pattern.
 *
 * 1. Filter (recency / distance / size / class).
 * 2. Drop outliers (Tukey 1.5x IQR on $/sqm).
 * 3. Weight surviving comps by recency, distance, quality.
 * 4. Return weighted median ± 1-sigma CI.
 */

import type { AssetClass, ComparableSale, TriangulationResult } from '../types.js';

export interface TriangulationFilters {
  readonly maxMonthsAgo: number;
  readonly maxDistanceMetres: number;
  readonly assetClass: AssetClass;
  readonly subjectSizeSqm: number;
  /** Acceptable ± share (e.g. 0.25 = within ±25 %). */
  readonly sizeTolerance: number;
}

export function triangulate(
  comps: ReadonlyArray<ComparableSale>,
  filters: TriangulationFilters,
): TriangulationResult {
  const filtered = comps.filter(
    (c) =>
      c.assetClass === filters.assetClass &&
      c.monthsAgo <= filters.maxMonthsAgo &&
      c.distanceMetres <= filters.maxDistanceMetres &&
      Math.abs(c.sizeSqm - filters.subjectSizeSqm) / filters.subjectSizeSqm <=
        filters.sizeTolerance,
  );

  if (filtered.length === 0) {
    return {
      used: [],
      droppedOutliers: [],
      weightedMedianPerSqm: 0,
      lowerCi: 0,
      upperCi: 0,
      confidence: 0,
    };
  }

  const { surviving, dropped } = tukeyDrop(filtered);
  if (surviving.length === 0) {
    return {
      used: [],
      droppedOutliers: dropped,
      weightedMedianPerSqm: 0,
      lowerCi: 0,
      upperCi: 0,
      confidence: 0,
    };
  }

  const weights = surviving.map((c) => weightOf(c, filters));
  const wmedian = weightedMedian(
    surviving.map((c) => c.salePricePerSqm),
    weights,
  );

  const variance = weightedVariance(
    surviving.map((c) => c.salePricePerSqm),
    weights,
    wmedian,
  );
  const sigma = Math.sqrt(variance);
  const lowerCi = Math.max(0, wmedian - sigma);
  const upperCi = wmedian + sigma;
  const confidence = clamp01(1 - sigma / Math.max(1, wmedian));

  return {
    used: surviving,
    droppedOutliers: dropped,
    weightedMedianPerSqm: wmedian,
    lowerCi,
    upperCi,
    confidence,
  };
}

function tukeyDrop(
  comps: ReadonlyArray<ComparableSale>,
): { surviving: ComparableSale[]; dropped: ComparableSale[] } {
  if (comps.length < 4) {
    return { surviving: [...comps], dropped: [] };
  }
  const prices = comps.map((c) => c.salePricePerSqm).sort((a, b) => a - b);
  const q1 = quantile(prices, 0.25);
  const q3 = quantile(prices, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const surviving: ComparableSale[] = [];
  const dropped: ComparableSale[] = [];
  for (const c of comps) {
    if (c.salePricePerSqm < lo || c.salePricePerSqm > hi) dropped.push(c);
    else surviving.push(c);
  }
  return { surviving, dropped };
}

function quantile(sorted: ReadonlyArray<number>, q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base] + rest * ((sorted[base + 1] ?? sorted[base]) - sorted[base]);
}

function weightOf(c: ComparableSale, filters: TriangulationFilters): number {
  const recencyW = 1 - c.monthsAgo / Math.max(1, filters.maxMonthsAgo);
  const distanceW = 1 - c.distanceMetres / Math.max(1, filters.maxDistanceMetres);
  return Math.max(0.01, 0.5 * recencyW + 0.3 * distanceW + 0.2 * c.qualitySimilarity);
}

function weightedMedian(values: ReadonlyArray<number>, weights: ReadonlyArray<number>): number {
  const pairs = values
    .map((v, i) => ({ v, w: weights[i] }))
    .sort((a, b) => a.v - b.v);
  const total = pairs.reduce((s, p) => s + p.w, 0);
  let cum = 0;
  for (const p of pairs) {
    cum += p.w;
    if (cum >= total / 2) return p.v;
  }
  return pairs[pairs.length - 1].v;
}

function weightedVariance(
  values: ReadonlyArray<number>,
  weights: ReadonlyArray<number>,
  mean: number,
): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return (
    values.reduce((acc, v, i) => acc + weights[i] * (v - mean) ** 2, 0) / total
  );
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
