import { describe, expect, it } from 'vitest';
import { scoreBrokers, selectBroker } from '../disposition/broker-selector.js';
import { designOM } from '../disposition/om-design-advisor.js';
import { modelSellerFinancing } from '../disposition/seller-financing-modeler.js';
import { adviseTaxDeferredExchange } from '../disposition/tax-deferred-exchange-advisor.js';
import type { BrokerCandidate } from '../types.js';

const brokers: ReadonlyArray<BrokerCandidate> = [
  {
    id: 'B-A',
    firm: 'Eastdil',
    comparableClosedDeals: 18,
    maxComparableClosedDeals: 20,
    assetClassBookShare: 0.80,
    buyerPoolMatch: 0.80,
    marketingBudgetShare: 0.20,
    submarketYears: 25,
    coBrokerWilling: true,
  },
  {
    id: 'B-B',
    firm: 'CBRE',
    comparableClosedDeals: 14,
    maxComparableClosedDeals: 20,
    assetClassBookShare: 0.70,
    buyerPoolMatch: 0.75,
    marketingBudgetShare: 0.30,
    submarketYears: 15,
    coBrokerWilling: true,
  },
  {
    id: 'B-C',
    firm: 'Local-Boutique',
    comparableClosedDeals: 5,
    maxComparableClosedDeals: 20,
    assetClassBookShare: 0.40,
    buyerPoolMatch: 0.30,
    marketingBudgetShare: 0.10,
    submarketYears: 8,
    coBrokerWilling: false,
  },
];

describe('broker-selector', () => {
  it('ranks Eastdil first on the test set', () => {
    const ranked = scoreBrokers(brokers);
    expect(ranked[0]!.id).toBe('B-A');
    expect(ranked[0]!.rank).toBe(1);
  });

  it('selectBroker returns top-2 bake-off', () => {
    const sel = selectBroker('A-1', brokers);
    expect(sel.bovBakeOff).toHaveLength(2);
  });

  it('handles empty candidate list', () => {
    const sel = selectBroker('A-1', []);
    expect(sel.bovBakeOff).toHaveLength(0);
    expect(sel.ranked).toHaveLength(0);
  });
});

describe('om-design-advisor', () => {
  it('returns 12 sections for multifamily', () => {
    const om = designOM('A-1', 'multifamily');
    expect(om.sections).toHaveLength(12);
    const tenant = om.sections.find((s) => s.section === 'tenant-profiles');
    expect(tenant?.required).toBe(false);
  });

  it('requires tenant-profiles for office', () => {
    const om = designOM('A-1', 'office');
    const tenant = om.sections.find((s) => s.section === 'tenant-profiles');
    expect(tenant?.required).toBe(true);
  });

  it('estimatedPages > 0', () => {
    const om = designOM('A-1', 'industrial');
    expect(om.estimatedPages).toBeGreaterThan(0);
  });
});

describe('seller-financing-modeler', () => {
  it('IG buyer gets longer term and lower spread', () => {
    const ig = modelSellerFinancing({
      purchasePrice: 50_000_000,
      bankRatePct: 0.07,
      buyerCreditTier: 'IG',
      desiredTaxDeferral: false,
    });
    expect(ig.termYears).toBe(7);
    expect(ig.rateSpreadBps).toBe(100);
    expect(ig.personalGuarantee).toBe(false);
  });

  it('unrated buyer triggers cross-collateralisation', () => {
    const u = modelSellerFinancing({
      purchasePrice: 50_000_000,
      bankRatePct: 0.07,
      buyerCreditTier: 'unrated',
      desiredTaxDeferral: true,
    });
    expect(u.crossCollateralisation).toBe(true);
    expect(u.installmentSaleApplicable).toBe(true);
  });

  it('throws on zero purchase price', () => {
    expect(() => modelSellerFinancing({
      purchasePrice: 0,
      bankRatePct: 0.07,
      buyerCreditTier: 'IG',
      desiredTaxDeferral: false,
    })).toThrow();
  });
});

describe('tax-deferred-exchange-advisor', () => {
  it('US forward 1031 default', () => {
    const r = adviseTaxDeferredExchange({
      jurisdiction: 'US',
      equityInRelinquished: 5_000_000,
      replacementPurchase: 10_000_000,
      developedProperty: true,
    });
    expect(r.structure).toBe('forward-1031');
    expect(r.feasible).toBe(true);
  });

  it('US reverse 1031 fails statutory window > 180 days', () => {
    const r = adviseTaxDeferredExchange({
      jurisdiction: 'US',
      equityInRelinquished: 5_000_000,
      replacementPurchase: 10_000_000,
      developedProperty: true,
      daysSinceParking: 200,
    });
    expect(r.structure).toBe('reverse-1031');
    expect(r.feasible).toBe(false);
    expect(r.blockers.some((b) => b.includes('parking'))).toBe(true);
  });

  it('TZ developed property blocked from §47', () => {
    const r = adviseTaxDeferredExchange({
      jurisdiction: 'TZ',
      equityInRelinquished: 5_000_000,
      replacementPurchase: 10_000_000,
      developedProperty: true,
    });
    expect(r.structure).toBe('not-applicable');
    expect(r.feasible).toBe(false);
  });

  it('KE always SPV-rollover applicable', () => {
    const r = adviseTaxDeferredExchange({
      jurisdiction: 'KE',
      equityInRelinquished: 5_000_000,
      replacementPurchase: 10_000_000,
      developedProperty: true,
    });
    expect(r.structure).toBe('ke-spv-rollover');
    expect(r.feasible).toBe(true);
  });

  it('TZ undeveloped allowed', () => {
    const r = adviseTaxDeferredExchange({
      jurisdiction: 'TZ',
      equityInRelinquished: 5_000_000,
      replacementPurchase: 10_000_000,
      developedProperty: false,
    });
    expect(r.structure).toBe('tz-land-act-47');
    expect(r.feasible).toBe(true);
  });
});
