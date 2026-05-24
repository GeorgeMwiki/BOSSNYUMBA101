import { describe, expect, it } from 'vitest';
import { triangulateSales } from '../comps/sale-triangulator.js';
import type { ComparableSale } from '../types.js';

const filters = {
  maxMonthsAgo: 18,
  maxDistanceMetres: 1600,
  assetClass: 'multifamily' as const,
  subjectSizeSqm: 3500,
  sizeTolerance: 0.3,
};

const comps: ComparableSale[] = [
  { id: 'c1', salePricePerSqm: 1200, distanceMetres: 400, monthsAgo: 3, sizeSqm: 3400, assetClass: 'multifamily', qualitySimilarity: 0.9, capRate: 0.085 },
  { id: 'c2', salePricePerSqm: 1350, distanceMetres: 800, monthsAgo: 8, sizeSqm: 3700, assetClass: 'multifamily', qualitySimilarity: 0.85, capRate: 0.08 },
  { id: 'c3', salePricePerSqm: 1280, distanceMetres: 1200, monthsAgo: 12, sizeSqm: 3550, assetClass: 'multifamily', qualitySimilarity: 0.75, capRate: 0.087 },
  { id: 'c4', salePricePerSqm: 5000, distanceMetres: 1000, monthsAgo: 6, sizeSqm: 3600, assetClass: 'multifamily', qualitySimilarity: 0.7, capRate: 0.07 },
  { id: 'c5', salePricePerSqm: 1180, distanceMetres: 600, monthsAgo: 5, sizeSqm: 3450, assetClass: 'multifamily', qualitySimilarity: 0.88, capRate: 0.09 },
  { id: 'c6', salePricePerSqm: 1310, distanceMetres: 900, monthsAgo: 10, sizeSqm: 3500, assetClass: 'multifamily', qualitySimilarity: 0.82, capRate: 0.083 },
];

describe('sale-triangulator', () => {
  it('drops the obvious outlier (c4)', () => {
    const r = triangulateSales(comps, filters);
    expect(r.droppedOutliers.some((c) => c.id === 'c4')).toBe(true);
  });

  it('returns weighted median in plausible band 1100..1400', () => {
    const r = triangulateSales(comps, filters);
    expect(r.weightedMedianPerSqm).toBeGreaterThan(1100);
    expect(r.weightedMedianPerSqm).toBeLessThan(1400);
  });

  it('returns zeros when nothing matches the filter', () => {
    const r = triangulateSales(comps, { ...filters, assetClass: 'office' });
    expect(r.weightedMedianPerSqm).toBe(0);
    expect(r.used.length).toBe(0);
  });

  it('confidence is in [0,1]', () => {
    const r = triangulateSales(comps, filters);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it('lower CI is always >= 0', () => {
    const r = triangulateSales(comps, filters);
    expect(r.lowerCi).toBeGreaterThanOrEqual(0);
  });

  it('applies adjustmentFactor to comp before triangulation', () => {
    const adjusted: ComparableSale[] = comps.map((c) =>
      c.id === 'c4' ? c : { ...c, adjustmentFactor: 1.10 },
    );
    const r = triangulateSales(adjusted, filters);
    const rBase = triangulateSales(comps, filters);
    expect(r.weightedMedianPerSqm).toBeGreaterThan(rBase.weightedMedianPerSqm);
  });

  it('upperCi >= weightedMedian and weightedMedian >= lowerCi', () => {
    const r = triangulateSales(comps, filters);
    expect(r.upperCi).toBeGreaterThanOrEqual(r.weightedMedianPerSqm);
    expect(r.weightedMedianPerSqm).toBeGreaterThanOrEqual(r.lowerCi);
  });
});
