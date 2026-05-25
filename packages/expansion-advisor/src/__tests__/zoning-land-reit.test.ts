import { describe, expect, it } from 'vitest';
import { zoningLeverageScore } from '../market/zoning-leverage.js';
import { forecastLandBanking } from '../market/land-banking.js';
import { reitMultiples, SECTOR_AFFO_MULTIPLE } from '../market/reit-comparables.js';

describe('zoning-leverage', () => {
  it('chooses upzone when corridor target is much higher', () => {
    const r = zoningLeverageScore({
      currentFar: 1,
      corridorTargetFar: 4,
      varianceApprovalRate: 0.2,
      varianceUpliftPct: 0.05,
      mixedUsePremiumPct: 0.05,
    });
    expect(r.bestLever).toBe('upzone');
  });

  it('chooses variance when approval × uplift dominates', () => {
    const r = zoningLeverageScore({
      currentFar: 3,
      corridorTargetFar: 3,
      varianceApprovalRate: 1,
      varianceUpliftPct: 0.9,
      mixedUsePremiumPct: 0.1,
    });
    expect(r.bestLever).toBe('variance');
  });

  it('chooses mixed-use when only that has uplift', () => {
    const r = zoningLeverageScore({
      currentFar: 4,
      corridorTargetFar: 4,
      varianceApprovalRate: 0,
      varianceUpliftPct: 0,
      mixedUsePremiumPct: 0.9,
    });
    expect(r.bestLever).toBe('mixedUse');
  });

  it('composite in [0,1]', () => {
    const r = zoningLeverageScore({
      currentFar: 1,
      corridorTargetFar: 4,
      varianceApprovalRate: 1,
      varianceUpliftPct: 1,
      mixedUsePremiumPct: 1,
    });
    expect(r.composite).toBeLessThanOrEqual(1);
    expect(r.composite).toBeGreaterThanOrEqual(0);
  });
});

describe('land-banking', () => {
  it('produces increasing index over horizon', () => {
    const r = forecastLandBanking(
      {
        distanceCbdKm: 10,
        distanceTrunkRoadKm: 2,
        infraPipeline5yrOverlap: 0.8,
        infraPipeline10yrOverlap: 0.9,
        zoningElasticity: 0.7,
      },
      { horizonYears: 10 },
    );
    for (let i = 1; i < r.years.length; i += 1) {
      expect(r.years[i].indexValue).toBeGreaterThanOrEqual(r.years[i - 1].indexValue);
    }
  });

  it('verdict reflects high-quality parcel', () => {
    const r = forecastLandBanking(
      {
        distanceCbdKm: 10,
        distanceTrunkRoadKm: 1,
        infraPipeline5yrOverlap: 1,
        infraPipeline10yrOverlap: 1,
        zoningElasticity: 1,
      },
      { horizonYears: 5 },
    );
    expect(['accumulate', 'aggressive']).toContain(r.verdict);
  });

  it('verdict reflects poor parcel', () => {
    const r = forecastLandBanking(
      {
        distanceCbdKm: 70,
        distanceTrunkRoadKm: 30,
        infraPipeline5yrOverlap: 0,
        infraPipeline10yrOverlap: 0,
        zoningElasticity: 0,
      },
      { horizonYears: 5 },
    );
    expect(['avoid', 'watch']).toContain(r.verdict);
  });

  it('throws on bad horizon', () => {
    expect(() =>
      forecastLandBanking(
        {
          distanceCbdKm: 10,
          distanceTrunkRoadKm: 1,
          infraPipeline5yrOverlap: 0,
          infraPipeline10yrOverlap: 0,
          zoningElasticity: 0,
        },
        { horizonYears: 0 },
      ),
    ).toThrow();
  });
});

describe('reit-comparables', () => {
  it('computes FFO and AFFO per textbook', () => {
    const r = reitMultiples(
      {
        netIncome: 100,
        depreciation: 60,
        amortisation: 10,
        gainsOnSale: 5,
        recurringCapex: 15,
        straightLineRentAdj: 5,
        noi: 200,
        capRate: 0.07,
        cash: 50,
        debt: 800,
        preferredEquity: 100,
      },
      'multifamily',
    );
    expect(r.ffo).toBe(165);
    expect(r.affo).toBe(145);
  });

  it('NAV = NOI/cap + cash - debt - pref', () => {
    const r = reitMultiples(
      {
        netIncome: 0,
        depreciation: 0,
        amortisation: 0,
        gainsOnSale: 0,
        recurringCapex: 0,
        straightLineRentAdj: 0,
        noi: 100,
        capRate: 0.05,
        cash: 50,
        debt: 800,
        preferredEquity: 100,
      },
      'industrial',
    );
    expect(r.nav).toBe(100 / 0.05 + 50 - 800 - 100);
  });

  it('implied AFFO value uses sector multiple', () => {
    const r = reitMultiples(
      {
        netIncome: 100,
        depreciation: 0,
        amortisation: 0,
        gainsOnSale: 0,
        recurringCapex: 0,
        straightLineRentAdj: 0,
        noi: 100,
        capRate: 0.08,
        cash: 0,
        debt: 0,
        preferredEquity: 0,
      },
      'multifamily',
    );
    expect(r.impliedValueViaAffo).toBe(100 * SECTOR_AFFO_MULTIPLE.multifamily);
  });
});
