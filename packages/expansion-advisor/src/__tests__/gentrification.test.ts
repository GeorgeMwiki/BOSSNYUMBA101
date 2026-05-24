import { describe, expect, it } from 'vitest';
import { computeGentrificationIndex } from '../market/gentrification-index.js';
import type { GentrificationAxes } from '../types.js';

const allLow: GentrificationAxes = {
  medianIncomeTrajectory: 0,
  educationalAttainment: 0,
  newBuildPermitDensity: 0,
  cafeDensity: 0,
  crimeRateDecline: 0,
  rentGrowthVelocity: 0,
  ownerOccupierShare: 0,
  transitAccessibility: 0,
};
const allHigh: GentrificationAxes = {
  medianIncomeTrajectory: 1,
  educationalAttainment: 1,
  newBuildPermitDensity: 1,
  cafeDensity: 1,
  crimeRateDecline: 1,
  rentGrowthVelocity: 1,
  ownerOccupierShare: 1,
  transitAccessibility: 1,
};

describe('gentrification-index', () => {
  it('scores at 0 for all-low', () => {
    expect(computeGentrificationIndex(allLow).score).toBeCloseTo(0, 6);
  });

  it('scores at 1 for all-high', () => {
    expect(computeGentrificationIndex(allHigh).score).toBeCloseTo(1, 6);
  });

  it('verdict bucketing covers all bands', () => {
    expect(computeGentrificationIndex(allLow).verdict).toBe('low');
    expect(computeGentrificationIndex(allHigh).verdict).toBe('late');
  });

  it('rejects out-of-range axis values', () => {
    expect(() =>
      computeGentrificationIndex({ ...allLow, cafeDensity: 1.5 }),
    ).toThrow(/cafeDensity/);
  });

  it('attributes contributions per axis', () => {
    const r = computeGentrificationIndex(allHigh);
    expect(r.contribution.medianIncomeTrajectory).toBeCloseTo(0.15, 6);
    expect(r.contribution.cafeDensity).toBeCloseTo(0.10, 6);
  });
});
