import { describe, it, expect } from 'vitest';
import { benchmarkIrem, IREM_MULTIFAMILY_2024 } from '../operations/irem-benchmarker.js';
import { disaggregateOpex } from '../operations/opex-disaggregator.js';
import {
  benchmarkUtilities,
  __test__ as utilTest,
} from '../operations/utility-benchmarker.js';
import {
  benchmarkSatisfaction,
  KINGSLEY_P50,
} from '../operations/satisfaction-benchmarker.js';
import { makePortfolio, TENANT_ID } from './fixtures.js';

describe('irem-benchmarker', () => {
  it('emits OER action recommendation when above 55%', () => {
    const portfolio = makePortfolio({
      properties: makePortfolio().properties.map((p) => ({
        ...p,
        annualOpexUsd: p.annualRevenueUsd * 0.7,
      })),
    });
    const r = benchmarkIrem(portfolio);
    expect(r.recommendations.find((rec) => rec.id === 'irem.oer.action')).toBeDefined();
  });

  it('benchmark thresholds are monotonic target < caution < action', () => {
    expect(IREM_MULTIFAMILY_2024.oerTarget).toBeLessThan(IREM_MULTIFAMILY_2024.oerCaution);
    expect(IREM_MULTIFAMILY_2024.oerCaution).toBeLessThan(IREM_MULTIFAMILY_2024.oerAction);
  });

  it('returns empty report when no multifamily in portfolio', () => {
    const r = benchmarkIrem(makePortfolio({ properties: [] }));
    expect(r.recommendations).toEqual([]);
  });
});

describe('opex-disaggregator', () => {
  it('separates controllable from uncontrollable variance', () => {
    const out = disaggregateOpex([
      { category: 'r-and-m', actualUsd: 12000, budgetUsd: 10000 },
      { category: 'utilities', actualUsd: 22000, budgetUsd: 20000 },
    ]);
    expect(out.controllableVariancePct).toBeCloseTo(0.2);
    expect(out.uncontrollableVariancePct).toBeCloseTo(0.1);
  });

  it('moves > 10% variance to actionable, others to informational', () => {
    const out = disaggregateOpex([
      { category: 'r-and-m', actualUsd: 12000, budgetUsd: 10000 }, // 20% — actionable
      { category: 'cleaning', actualUsd: 10500, budgetUsd: 10000 }, // 5% — informational
    ]);
    expect(out.actionable.find((l) => l.category === 'r-and-m')).toBeDefined();
    expect(out.actionable.find((l) => l.category === 'cleaning')).toBeUndefined();
  });

  it('handles zero budget without crash', () => {
    const out = disaggregateOpex([
      { category: 'admin', actualUsd: 1000, budgetUsd: 0 },
    ]);
    expect(out.controllableVariancePct).toBe(0);
  });
});

describe('utility-benchmarker', () => {
  it('classifies low EUI as P25', () => {
    const r = benchmarkUtilities({
      tenantId: TENANT_ID,
      assetClass: 'office',
      siteEuiKbtuPerSfYear: 50,
      waterGalPerSfYear: 10,
    });
    expect(r.energyPercentile).toBe('P25');
  });

  it('classifies high EUI as below-P75', () => {
    const r = benchmarkUtilities({
      tenantId: TENANT_ID,
      assetClass: 'office',
      siteEuiKbtuPerSfYear: 120,
      waterGalPerSfYear: 100,
    });
    expect(r.energyPercentile).toBe('below-P75');
  });

  it('emits ENERGY STAR rec when score < 50', () => {
    const r = benchmarkUtilities({
      tenantId: TENANT_ID,
      assetClass: 'office',
      siteEuiKbtuPerSfYear: 50,
      waterGalPerSfYear: 10,
      energyStarScore: 40,
    });
    expect(r.recommendations.find((x) => x.id === 'util.estar.low')).toBeDefined();
  });

  it('emits NABERS rec when stars < 4.5', () => {
    const r = benchmarkUtilities({
      tenantId: TENANT_ID,
      assetClass: 'office',
      siteEuiKbtuPerSfYear: 50,
      waterGalPerSfYear: 10,
      nabersStars: 3.5,
    });
    expect(r.recommendations.find((x) => x.id === 'util.nabers.low')).toBeDefined();
  });

  it('water rec triggers above P50', () => {
    const r = benchmarkUtilities({
      tenantId: TENANT_ID,
      assetClass: 'multifamily',
      siteEuiKbtuPerSfYear: 50,
      waterGalPerSfYear: 100,
    });
    expect(r.recommendations.find((x) => x.id === 'util.water.high')).toBeDefined();
  });

  it('multifamily EUI band differs from office', () => {
    expect(utilTest.MF_EUI.p50).not.toBe(utilTest.OFFICE_EUI.p50);
  });
});

describe('satisfaction-benchmarker', () => {
  it('flags overall score 6+ points below Kingsley P50', () => {
    const r = benchmarkSatisfaction({
      tenantId: TENANT_ID,
      overall: 70,
      maintenance: 76,
      communication: 74,
      moveInExperience: 80,
      renewalIntentPct: 0.6,
    });
    expect(r.recommendations.find((rec) => rec.id === 'sat.overall.low')).toBeDefined();
  });

  it('flags critical when renewal intent collapses 10+ pp', () => {
    const r = benchmarkSatisfaction({
      tenantId: TENANT_ID,
      overall: 78,
      maintenance: 76,
      communication: 74,
      moveInExperience: 81,
      renewalIntentPct: 0.45,
    });
    expect(r.recommendations.find((rec) => rec.id === 'sat.renewal.low')).toBeDefined();
  });

  it('Kingsley overall P50 is 78', () => {
    expect(KINGSLEY_P50.overall).toBe(78);
  });

  it('no recommendations when at-or-above peer', () => {
    const r = benchmarkSatisfaction({
      tenantId: TENANT_ID,
      overall: 80,
      maintenance: 80,
      communication: 76,
      moveInExperience: 82,
      renewalIntentPct: 0.65,
    });
    expect(r.recommendations).toEqual([]);
  });
});
