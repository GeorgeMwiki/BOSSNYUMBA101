import { describe, expect, it } from 'vitest';
import { analyzeEntitlementPath } from '../zoning/entitlement-path-analyzer.js';
import { scoreOpposition } from '../zoning/opposition-scorer.js';

describe('analyzeEntitlementPath', () => {
  it('by-right has high approval probability and low cost', () => {
    const r = analyzeEntitlementPath({
      path: 'by-right',
      jurisdiction: 'US',
      oppositionScore: 20,
    });
    expect(r.probabilityOfApproval).toBeGreaterThan(0.90);
    expect(r.cost).toBeLessThan(60_000);
    expect(r.riskLevel).toBe('low');
  });

  it('rezoning with high opposition has low approval probability', () => {
    const r = analyzeEntitlementPath({
      path: 'rezoning',
      jurisdiction: 'US',
      oppositionScore: 85,
    });
    expect(r.probabilityOfApproval).toBeLessThan(0.30);
    expect(r.estimatedMonths).toBeGreaterThan(18);
  });

  it('EA jurisdictions get longer schedule + lower cost', () => {
    const us = analyzeEntitlementPath({
      path: 'variance',
      jurisdiction: 'US',
      oppositionScore: 50,
    });
    const ke = analyzeEntitlementPath({
      path: 'variance',
      jurisdiction: 'KE',
      oppositionScore: 50,
    });
    expect(ke.estimatedMonths).toBeGreaterThan(us.estimatedMonths);
    expect(ke.cost).toBeLessThan(us.cost);
    expect(ke.notes.some((n) => n.includes('EA timeline'))).toBe(true);
  });

  it('political alignment lifts approval probability', () => {
    const base = analyzeEntitlementPath({
      path: 'special-use',
      jurisdiction: 'US',
      oppositionScore: 40,
    });
    const lifted = analyzeEntitlementPath({
      path: 'special-use',
      jurisdiction: 'US',
      oppositionScore: 40,
      politicalAlignmentAdj: 0.15,
    });
    expect(lifted.probabilityOfApproval).toBeGreaterThan(base.probabilityOfApproval);
  });

  it('high opposition triggers "expect material opposition" note', () => {
    const r = analyzeEntitlementPath({
      path: 'rezoning',
      jurisdiction: 'US',
      oppositionScore: 80,
    });
    expect(r.notes.some((n) => n.includes('material opposition'))).toBe(true);
  });

  it('rejects opposition score out of range', () => {
    expect(() =>
      analyzeEntitlementPath({
        path: 'by-right',
        jurisdiction: 'US',
        oppositionScore: 150,
      }),
    ).toThrow();
  });
});

describe('scoreOpposition', () => {
  it('low score for healthy renter mix + transit-rich + no recent contests', () => {
    const r = scoreOpposition({
      hoaDensityWithin0_8Km: 0,
      ownerOccupiedSharePct: 30,
      medianHouseholdIncomeUsd: 75_000,
      contestedRezoningCountLast5Yr: 0,
      distanceToHistoricDistrictMetres: 5_000,
      transitProximityScore: 0.9,
      educationAttainmentSharePct: 40,
    });
    expect(r.band).toMatch(/low|moderate/);
    expect(r.score).toBeLessThan(50);
  });

  it('high score for HOA-rich, owner-occupied, contested area', () => {
    const r = scoreOpposition({
      hoaDensityWithin0_8Km: 7,
      ownerOccupiedSharePct: 85,
      medianHouseholdIncomeUsd: 160_000,
      contestedRezoningCountLast5Yr: 4,
      distanceToHistoricDistrictMetres: 200,
      transitProximityScore: 0.2,
      educationAttainmentSharePct: 80,
    });
    expect(r.band).toMatch(/high|severe/);
  });

  it('returns score in [0,100]', () => {
    const r = scoreOpposition({
      hoaDensityWithin0_8Km: 3,
      ownerOccupiedSharePct: 50,
      medianHouseholdIncomeUsd: 60_000,
      contestedRezoningCountLast5Yr: 1,
      distanceToHistoricDistrictMetres: 1500,
      transitProximityScore: 0.4,
      educationAttainmentSharePct: 50,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
