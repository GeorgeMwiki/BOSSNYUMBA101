import { describe, expect, it } from 'vitest';
import { recommendExpansion } from '../advisor/expansion-recommender.js';
import type {
  CandidateUse,
  ComparableSale,
  ExpansionInputs,
  MarketSnapshot,
  Parcel,
} from '../types.js';

const parcel: Parcel = {
  id: 'p-rec-1',
  lat: -1.29,
  lng: 36.82,
  siteAreaSqm: 5000,
  zoning: 'R3',
  far: 4.0,
  maxHeightM: 50,
  setbacksM: { front: 5, side: 4, rear: 5 },
  jurisdiction: 'KE',
  slopePct: 3,
  soilBearingKpa: 200,
  utilities: { power: true, water: true, sewer: true },
};

const goodUse: CandidateUse = {
  id: 'mf-mid',
  label: 'Mid-rise multifamily',
  assetClass: 'multifamily',
  programmeSqm: 7000,
  heightM: 28,
  far: 2.2,
  nlaSqm: 6000,
  units: 70,
  stabilisedRentPerSqm: 22,
  operatingExpenseRatio: 0.32,
  capRate: 0.085,
  buildCostPerSqm: 750,
  landBasis: 1_200_000,
  buildMonths: 16,
};

const market: MarketSnapshot = {
  assetClass: 'multifamily',
  subMarket: 'Kileleshwa',
  activeInventoryUnits: 200,
  monthlyAbsorptionUnits: 15,
  comparableRentPerSqm: 24,
  comparableSalePsfPerSqm: 2200,
  capRate: 0.085,
};

const comps: ComparableSale[] = [
  { id: 'c1', salePricePerSqm: 2000, distanceMetres: 400, monthsAgo: 3, sizeSqm: 6100, assetClass: 'multifamily', qualitySimilarity: 0.9 },
  { id: 'c2', salePricePerSqm: 2200, distanceMetres: 800, monthsAgo: 8, sizeSqm: 5800, assetClass: 'multifamily', qualitySimilarity: 0.8 },
  { id: 'c3', salePricePerSqm: 2100, distanceMetres: 1200, monthsAgo: 12, sizeSqm: 6500, assetClass: 'multifamily', qualitySimilarity: 0.7 },
];

const input: ExpansionInputs = {
  parcel,
  candidates: [goodUse],
  market,
  comparables: comps,
  gentrification: {
    medianIncomeTrajectory: 0.6,
    educationalAttainment: 0.5,
    newBuildPermitDensity: 0.7,
    cafeDensity: 0.6,
    crimeRateDecline: 0.5,
    rentGrowthVelocity: 0.7,
    ownerOccupierShare: 0.4,
    transitAccessibility: 0.8,
  },
  zoningLeverage: {
    currentFar: 2.5,
    corridorTargetFar: 4.0,
    varianceApprovalRate: 0.5,
    varianceUpliftPct: 0.3,
    mixedUsePremiumPct: 0.2,
  },
  stack: {
    totalCost: 0,
    stabilisedNOI: 0,
    stabilisedValue: 0,
    tiers: [
      { tier: 'seniorDebt', maxShareOfCost: 0.60, rate: 0.06 },
      { tier: 'mezzanine', maxShareOfCost: 0.15, rate: 0.11 },
      { tier: 'preferredEquity', maxShareOfCost: 0.10, rate: 0.09 },
      { tier: 'commonEquity', maxShareOfCost: 1.0, rate: 0.15 },
    ],
    constraints: {
      minDscr: 1.20,
      minIcr: 1.20,
      maxLtc: 0.75,
      maxLtv: 0.85,
      minYieldOnCost: 0.07,
    },
  },
  landBanking: {
    distanceCbdKm: 8,
    distanceTrunkRoadKm: 1,
    infraPipeline5yrOverlap: 0.7,
    infraPipeline10yrOverlap: 0.8,
    zoningElasticity: 0.6,
  },
};

describe('recommendExpansion', () => {
  it('returns a full opportunity report', () => {
    const r = recommendExpansion(input, {
      legality: { zoningAllowance: { R3: ['multifamily', 'mixed-use'] } },
      physical: {
        maxSlopePct: 20,
        minSoilBearingKpa: 100,
        requireUtilitiesOnSite: true,
      },
      financial: {
        hurdleIrr: 0.10,
        discountRate: 0.08,
        holdPeriodYears: 7,
        exitCapRate: 0.085,
        confidenceTarget: 0.5,
      },
      horizonMonths: 36,
      landBankingHorizonYears: 5,
    });
    expect(r.recommendedUse.id).toBe('mf-mid');
    expect(r.stack.dscr).toBeGreaterThan(1.2);
    expect(r.absorption.leaseUpMonthsTo95).toBeGreaterThan(0);
    expect(r.triangulation.weightedMedianPerSqm).toBeGreaterThan(0);
    expect(r.gentrification.verdict).toBeTruthy();
    expect(r.zoningLeverage.composite).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.narrative).toMatch(/recommend Mid-rise multifamily/);
    expect(r.landBanking?.cagrPct).toBeGreaterThan(0);
  });

  it('applies market overrides to candidates', () => {
    const r = recommendExpansion(
      {
        ...input,
        marketOverrides: { rentMultiplier: 1.1, costMultiplier: 0.95, capRateAdjustment: -0.005 },
      },
      {
        legality: { zoningAllowance: { R3: ['multifamily'] } },
        physical: {
          maxSlopePct: 20,
          minSoilBearingKpa: 100,
          requireUtilitiesOnSite: true,
        },
        financial: {
          hurdleIrr: 0.10,
          discountRate: 0.08,
          holdPeriodYears: 7,
          exitCapRate: 0.08,
          confidenceTarget: 0.5,
        },
        horizonMonths: 24,
      },
    );
    expect(r.recommendedUse.capRate).toBeLessThan(goodUse.capRate);
  });

  it('throws if no candidate survives gates', () => {
    expect(() =>
      recommendExpansion(input, {
        legality: { zoningAllowance: { R3: ['office'] } },
        physical: {
          maxSlopePct: 20,
          minSoilBearingKpa: 100,
          requireUtilitiesOnSite: true,
        },
        financial: {
          hurdleIrr: 0.10,
          discountRate: 0.08,
          holdPeriodYears: 7,
          exitCapRate: 0.08,
          confidenceTarget: 0.5,
        },
        horizonMonths: 24,
      }),
    ).toThrow(/no candidate/);
  });
});
