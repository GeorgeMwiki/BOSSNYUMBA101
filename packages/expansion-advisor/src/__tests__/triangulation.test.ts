import { describe, expect, it } from 'vitest';
import { triangulate } from '../market/comparable-sales-triangulator.js';
import type { ComparableSale } from '../types.js';

const subject = {
  maxMonthsAgo: 18,
  maxDistanceMetres: 1600,
  assetClass: 'multifamily' as const,
  subjectSizeSqm: 7000,
  sizeTolerance: 0.3,
};

const comps: ComparableSale[] = [
  { id: 'c1', salePricePerSqm: 2000, distanceMetres: 400, monthsAgo: 3, sizeSqm: 7100, assetClass: 'multifamily', qualitySimilarity: 0.9 },
  { id: 'c2', salePricePerSqm: 2200, distanceMetres: 800, monthsAgo: 8, sizeSqm: 6800, assetClass: 'multifamily', qualitySimilarity: 0.8 },
  { id: 'c3', salePricePerSqm: 2100, distanceMetres: 1200, monthsAgo: 12, sizeSqm: 7500, assetClass: 'multifamily', qualitySimilarity: 0.7 },
  { id: 'c4', salePricePerSqm: 8000, distanceMetres: 1000, monthsAgo: 10, sizeSqm: 7200, assetClass: 'multifamily', qualitySimilarity: 0.6 },
  { id: 'c5', salePricePerSqm: 1900, distanceMetres: 600, monthsAgo: 5, sizeSqm: 6900, assetClass: 'multifamily', qualitySimilarity: 0.85 },
];

describe('triangulator', () => {
  it('drops the obvious outlier', () => {
    const r = triangulate(comps, subject);
    expect(r.droppedOutliers.find((c) => c.id === 'c4')).toBeDefined();
  });

  it('returns weighted median in plausible band', () => {
    const r = triangulate(comps, subject);
    expect(r.weightedMedianPerSqm).toBeGreaterThan(1800);
    expect(r.weightedMedianPerSqm).toBeLessThan(2300);
  });

  it('returns zeros when nothing matches the filter', () => {
    const r = triangulate(comps, { ...subject, assetClass: 'industrial' });
    expect(r.weightedMedianPerSqm).toBe(0);
    expect(r.used.length).toBe(0);
  });

  it('confidence is in [0,1]', () => {
    const r = triangulate(comps, subject);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it('lower CI is always >= 0', () => {
    const r = triangulate(comps, subject);
    expect(r.lowerCi).toBeGreaterThanOrEqual(0);
  });
});
