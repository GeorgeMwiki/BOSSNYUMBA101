import { describe, it, expect } from 'vitest';
import {
  rankRetentionTactics,
  RETENTION_LEVERS,
} from '../tenant-strategy/retention-tactic-ranker.js';
import { analyzeAcqRetention, __test__ } from '../tenant-strategy/acquisition-vs-retention-econ.js';
import { scoreDemographicFit } from '../tenant-strategy/demographic-fit-scorer.js';
import { TENANT_ID } from './fixtures.js';

describe('retention-tactic-ranker', () => {
  it('ranks in-unit w/d as top ROI lever', () => {
    expect(RETENTION_LEVERS['in-unit-w-d'].avgRoi).toBeGreaterThan(
      RETENTION_LEVERS['rent-reduction'].avgRoi,
    );
  });

  it('funds highest-ROI levers first within budget', () => {
    const ranked = rankRetentionTactics({
      budgetUsd: 1500,
      costPerLeverUsd: {
        'in-unit-w-d': 1000,
        'smart-home-upgrade': 600,
        'rent-reduction': 800,
      },
    });
    expect(ranked[0]?.lever).toBe('in-unit-w-d');
    expect(ranked[0]?.funded).toBe(true);
  });

  it('excludes specified levers', () => {
    const ranked = rankRetentionTactics({
      budgetUsd: 5000,
      costPerLeverUsd: {
        'rent-reduction': 1000,
        'in-unit-w-d': 1000,
      },
      excludedLevers: ['rent-reduction'],
    });
    expect(ranked.find((r) => r.lever === 'rent-reduction')).toBeUndefined();
  });

  it('respects budget cap with multi-lever selection', () => {
    const ranked = rankRetentionTactics({
      budgetUsd: 1500,
      costPerLeverUsd: {
        'in-unit-w-d': 1000,
        'reserved-parking': 800,
      },
    });
    const totalFunded = ranked.filter((r) => r.funded).reduce((s, r) => s + r.costUsd, 0);
    expect(totalFunded).toBeLessThanOrEqual(1500);
  });
});

describe('acquisition-vs-retention-econ', () => {
  it('flags high CAC when above multifamily P75', () => {
    const out = analyzeAcqRetention({
      tenantId: TENANT_ID,
      assetClass: 'multifamily',
      avgMonthlyRentUsd: 1500,
      currentTurnoverRate: 0.3,
      currentAcquisitionCostPerUnitUsd: 3000,
      currentRetentionSpendPerRenewalUsd: 600,
    });
    expect(out.recommendations.find((r) => r.id === 'acq.cac.high')).toBeDefined();
  });

  it('flags low retention spend', () => {
    const out = analyzeAcqRetention({
      tenantId: TENANT_ID,
      assetClass: 'multifamily',
      avgMonthlyRentUsd: 1500,
      currentTurnoverRate: 0.3,
      currentAcquisitionCostPerUnitUsd: 2000,
      currentRetentionSpendPerRenewalUsd: 200,
    });
    expect(out.recommendations.find((r) => r.id === 'ret.spend.low')).toBeDefined();
  });

  it('flags > 40% turnover', () => {
    const out = analyzeAcqRetention({
      tenantId: TENANT_ID,
      assetClass: 'multifamily',
      avgMonthlyRentUsd: 1500,
      currentTurnoverRate: 0.5,
      currentAcquisitionCostPerUnitUsd: 2000,
      currentRetentionSpendPerRenewalUsd: 700,
    });
    expect(out.recommendations.find((r) => r.id === 'turnover.high')).toBeDefined();
  });

  it('CAC_BANDS multifamily inside expected range', () => {
    const [min, max] = __test__.CAC_BANDS.multifamily;
    expect(min).toBe(1200);
    expect(max).toBe(2500);
  });
});

describe('demographic-fit-scorer', () => {
  it('classifies comfortable when income/rent >= 3', () => {
    const out = scoreDemographicFit({
      medianHouseholdIncomeUsd: 60_000,
      medianRentUsd: 1500,
      householdSizeAvg: 2.4,
      unitMixBedrooms: [{ br: 1, share: 0.3 }, { br: 2, share: 0.7 }],
      avgAge: 30,
      amenityFit: 'young-professional',
      commuteMinAvg: 25,
    });
    expect(out.rentBurden).toBe('comfortable');
  });

  it('classifies severely-burdened when ratio < 2', () => {
    const out = scoreDemographicFit({
      medianHouseholdIncomeUsd: 24_000,
      medianRentUsd: 1500,
      householdSizeAvg: 3,
      unitMixBedrooms: [{ br: 1, share: 1.0 }],
      avgAge: 40,
      amenityFit: 'family',
      commuteMinAvg: 25,
    });
    expect(out.rentBurden).toBe('severely-burdened');
  });

  it('flags under-supply of large units for family demographic', () => {
    const out = scoreDemographicFit({
      medianHouseholdIncomeUsd: 80_000,
      medianRentUsd: 1500,
      householdSizeAvg: 4,
      unitMixBedrooms: [{ br: 1, share: 0.8 }, { br: 2, share: 0.2 }],
      avgAge: 38,
      amenityFit: 'family',
      commuteMinAvg: 20,
    });
    expect(out.unitMixFit).toBe('under-supply-large');
  });

  it('penalises long commute', () => {
    const short = scoreDemographicFit({
      medianHouseholdIncomeUsd: 60_000,
      medianRentUsd: 1500,
      householdSizeAvg: 2.4,
      unitMixBedrooms: [{ br: 1, share: 1 }],
      avgAge: 30,
      amenityFit: 'young-professional',
      commuteMinAvg: 20,
    });
    const long = scoreDemographicFit({
      medianHouseholdIncomeUsd: 60_000,
      medianRentUsd: 1500,
      householdSizeAvg: 2.4,
      unitMixBedrooms: [{ br: 1, share: 1 }],
      avgAge: 30,
      amenityFit: 'young-professional',
      commuteMinAvg: 60,
    });
    expect(long.compositeFit).toBeLessThan(short.compositeFit);
  });
});
