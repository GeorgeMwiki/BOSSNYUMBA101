/**
 * Rent-comp triangulator — CompStak / Knight Frank / Broll
 * convention for lease-comp aggregation.
 *
 * Adjusts for: term length (longer term ~ lower in-place rent),
 * tenant covenant (IG = 1.0, NIG = 0.93, SME = 0.85, gov = 1.05).
 * Returns weighted median + 1-sigma confidence.
 */

import type { AssetClass, ComparableLease, RentTriangulation } from '../types.js';

export interface RentTriangulationFilters {
  readonly maxMonthsAgo: number;
  readonly maxDistanceMetres: number;
  readonly assetClass: AssetClass;
  readonly subjectSizeSqm: number;
  readonly sizeTolerance: number;
  /** Target term in years for normalization (default 5). */
  readonly targetTermYears?: number;
}

const COVENANT_MULTIPLIER = {
  IG: 1.00,
  NIG: 0.93,
  SME: 0.85,
  gov: 1.05,
} as const;

export function triangulateRents(
  comps: ReadonlyArray<ComparableLease>,
  filters: RentTriangulationFilters,
): RentTriangulation {
  const targetTerm = filters.targetTermYears ?? 5;
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
      weightedMedianRentPerSqm: 0,
      confidence: 0,
    };
  }

  // Normalize each comp's rent for covenant + term
  const normalized = filtered.map((c) => {
    const covMult = COVENANT_MULTIPLIER[c.tenantCovenant] ?? 1.0;
    const termMult = 1 + (c.termYears - targetTerm) * 0.005; // 50 bps per year
    return {
      ...c,
      rentPerSqmPerYear: (c.rentPerSqmPerYear / covMult) / termMult,
    };
  });

  const { surviving, dropped } = tukeyDrop(normalized);
  if (surviving.length === 0) {
    return {
      used: [],
      droppedOutliers: dropped,
      weightedMedianRentPerSqm: 0,
      confidence: 0,
    };
  }

  const weights = surviving.map((c) => weightOf(c, filters));
  const wmedian = weightedMedian(
    surviving.map((c) => c.rentPerSqmPerYear),
    weights,
  );
  const sigma = Math.sqrt(
    weightedVariance(
      surviving.map((c) => c.rentPerSqmPerYear),
      weights,
      wmedian,
    ),
  );
  const cv = wmedian > 0 ? sigma / wmedian : 1;
  const sampleConfidence = Math.min(1, surviving.length / 6);
  const confidence = Math.max(0, Math.min(1, (1 - cv) * sampleConfidence));

  return {
    used: surviving,
    droppedOutliers: dropped,
    weightedMedianRentPerSqm: wmedian,
    confidence,
  };
}

function tukeyDrop(comps: ReadonlyArray<ComparableLease>): {
  surviving: ComparableLease[];
  dropped: ComparableLease[];
} {
  if (comps.length < 4) {
    return { surviving: [...comps], dropped: [] };
  }
  const prices = comps.map((c) => c.rentPerSqmPerYear).slice().sort((a, b) => a - b);
  const q1 = quantile(prices, 0.25);
  const q3 = quantile(prices, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const surviving: ComparableLease[] = [];
  const dropped: ComparableLease[] = [];
  for (const c of comps) {
    if (c.rentPerSqmPerYear < lo || c.rentPerSqmPerYear > hi) dropped.push(c);
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

function weightOf(c: ComparableLease, filters: RentTriangulationFilters): number {
  const recencyW = 1 - c.monthsAgo / Math.max(1, filters.maxMonthsAgo);
  const distanceW = 1 - c.distanceMetres / Math.max(1, filters.maxDistanceMetres);
  return Math.max(0.01, 0.5 * recencyW + 0.3 * distanceW + 0.2 * c.qualitySimilarity);
}

function weightedMedian(
  values: ReadonlyArray<number>,
  weights: ReadonlyArray<number>,
): number {
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
