import { describe, expect, it } from 'vitest';
import { legallyPermissible } from '../hbu/legally-permissible.js';
import { physicallyPossible } from '../hbu/physically-possible.js';
import { financiallyFeasible } from '../hbu/financially-feasible.js';
import { maximallyProductive } from '../hbu/maximally-productive.js';
import { analyzeHBU } from '../hbu/hbu-analyzer.js';
import type { CandidateUse, Parcel } from '../types.js';

const parcel: Parcel = {
  id: 'p1',
  lat: -1.29,
  lng: 36.82,
  siteAreaSqm: 5000,
  zoning: 'R3',
  far: 4.0,
  maxHeightM: 50,
  setbacksM: { front: 5, side: 4, rear: 5 },
  jurisdiction: 'KE',
  slopePct: 3,
  soilBearingKpa: 180,
  utilities: { power: true, water: true, sewer: true },
};

const goodUse: CandidateUse = {
  id: 'u1',
  label: 'Mid-rise multifamily',
  assetClass: 'multifamily',
  programmeSqm: 8000,
  heightM: 32,
  far: 2.5,
  nlaSqm: 7000,
  units: 80,
  stabilisedRentPerSqm: 18,
  operatingExpenseRatio: 0.35,
  capRate: 0.09,
  buildCostPerSqm: 800,
  landBasis: 1_500_000,
  buildMonths: 18,
};

describe('hbu: legallyPermissible', () => {
  it('passes when zoning allows and FAR + height fit', () => {
    const r = legallyPermissible(parcel, goodUse, {
      zoningAllowance: { R3: ['multifamily', 'mixed-use'] },
    });
    expect(r.outcome).toBe('pass');
  });

  it('fails when zoning disallows asset class', () => {
    const r = legallyPermissible(parcel, goodUse, {
      zoningAllowance: { R3: ['office'] },
    });
    expect(r.outcome).toBe('fail');
    expect(r.reasons[0]).toMatch(/does not allow/);
  });

  it('fails when FAR exceeds allowance', () => {
    const r = legallyPermissible(parcel, { ...goodUse, far: 99 }, {
      zoningAllowance: { R3: ['multifamily'] },
    });
    expect(r.outcome).toBe('fail');
  });

  it('fails when height exceeds allowance', () => {
    const r = legallyPermissible(parcel, { ...goodUse, heightM: 100 }, {
      zoningAllowance: { R3: ['multifamily'] },
    });
    expect(r.outcome).toBe('fail');
  });

  it('fails when required entitlement not yet approved', () => {
    const r = legallyPermissible(
      parcel,
      { ...goodUse, requiredEntitlements: ['variance-X'] },
      { zoningAllowance: { R3: ['multifamily'] } },
    );
    expect(r.outcome).toBe('fail');
  });
});

describe('hbu: physicallyPossible', () => {
  it('passes with sane envelope', () => {
    const r = physicallyPossible(parcel, goodUse, {
      maxSlopePct: 15,
      minSoilBearingKpa: 100,
      requireUtilitiesOnSite: true,
    });
    expect(r.outcome).toBe('pass');
  });

  it('fails when slope exceeds rule', () => {
    const r = physicallyPossible(
      { ...parcel, slopePct: 30 },
      goodUse,
      { maxSlopePct: 15, minSoilBearingKpa: 0, requireUtilitiesOnSite: false },
    );
    expect(r.outcome).toBe('fail');
  });

  it('fails when soil bearing too low', () => {
    const r = physicallyPossible(
      { ...parcel, soilBearingKpa: 50 },
      goodUse,
      { maxSlopePct: 20, minSoilBearingKpa: 100, requireUtilitiesOnSite: false },
    );
    expect(r.outcome).toBe('fail');
  });

  it('fails when programme exceeds envelope', () => {
    const r = physicallyPossible(
      { ...parcel, siteAreaSqm: 100 },
      { ...goodUse, programmeSqm: 500_000, far: 1 },
      { maxSlopePct: 20, minSoilBearingKpa: 0, requireUtilitiesOnSite: false },
    );
    expect(r.outcome).toBe('fail');
  });
});

describe('hbu: financiallyFeasible', () => {
  it('passes a textbook value-add multifamily', () => {
    const r = financiallyFeasible(goodUse, {
      hurdleIrr: 0.10,
      discountRate: 0.08,
      holdPeriodYears: 7,
      exitCapRate: 0.08,
      confidenceTarget: 0.60,
    });
    expect(r.result.outcome).toBe('pass');
    expect(r.medianIrr).toBeGreaterThan(0.10);
  });

  it('fails a hopeless project', () => {
    const r = financiallyFeasible(
      { ...goodUse, stabilisedRentPerSqm: 2, buildCostPerSqm: 5_000 },
      {
        hurdleIrr: 0.10,
        discountRate: 0.08,
        holdPeriodYears: 7,
        exitCapRate: 0.08,
        confidenceTarget: 0.60,
      },
    );
    expect(r.result.outcome).toBe('fail');
  });
});

describe('hbu: maximallyProductive', () => {
  it('returns empty for empty inputs', () => {
    expect(maximallyProductive([])).toEqual([]);
  });

  it('ranks higher-yielding use first', () => {
    const r = maximallyProductive([
      {
        use: goodUse,
        medianIrr: 0.18,
        medianNpv: 800_000,
        stabilisedNoi: 800_000,
        siteAreaSqm: 5000,
      },
      {
        use: { ...goodUse, id: 'u2', stabilisedRentPerSqm: 8 },
        medianIrr: 0.08,
        medianNpv: 100_000,
        stabilisedNoi: 200_000,
        siteAreaSqm: 5000,
      },
    ]);
    expect(r[0].use.id).toBe('u1');
  });
});

describe('hbu: analyzeHBU', () => {
  it('chains gates and returns a ranked winner', () => {
    const r = analyzeHBU({
      parcel,
      uses: [goodUse],
      legality: { zoningAllowance: { R3: ['multifamily'] } },
      physical: { maxSlopePct: 20, minSoilBearingKpa: 100, requireUtilitiesOnSite: true },
      financial: {
        hurdleIrr: 0.10,
        discountRate: 0.08,
        holdPeriodYears: 7,
        exitCapRate: 0.08,
        confidenceTarget: 0.6,
      },
    });
    expect(r.winner?.id).toBe('u1');
    expect(r.ranked.length).toBe(1);
  });

  it('returns no winner when every use is illegal', () => {
    const r = analyzeHBU({
      parcel,
      uses: [goodUse],
      legality: { zoningAllowance: { R3: ['office'] } },
      physical: { maxSlopePct: 20, minSoilBearingKpa: 100, requireUtilitiesOnSite: false },
      financial: {
        hurdleIrr: 0.10,
        discountRate: 0.08,
        holdPeriodYears: 7,
        exitCapRate: 0.08,
        confidenceTarget: 0.6,
      },
    });
    expect(r.winner).toBeUndefined();
  });
});
