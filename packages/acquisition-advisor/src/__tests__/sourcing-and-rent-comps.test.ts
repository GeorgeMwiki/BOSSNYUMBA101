import { describe, expect, it } from 'vitest';
import { triangulateRents } from '../comps/rent-comp-triangulator.js';
import { scoreBroker, rankBrokers } from '../sourcing/broker-network-scorer.js';
import {
  scoreOffMarketTrigger,
  rankTriggers,
  OFF_MARKET_CONVERSION_PRIORS,
} from '../sourcing/off-market-trigger-miner.js';
import {
  getOutreachTemplate,
  listOutreachTemplates,
} from '../sourcing/owner-outreach-personalizer.js';
import {
  buyerMayTerminate,
  modelCasualtyCondemnation,
} from '../loi-psa/casualty-and-condemnation-modeler.js';
import { computeCapRateDerivative } from '../comps/cap-rate-derivative.js';
import { readAltaSurvey } from '../survey/alta-survey-reader.js';
import type { BrokerProfile, ComparableLease, ComparableSale } from '../types.js';

describe('scoreBroker', () => {
  const top: BrokerProfile = {
    id: 'CBRE-001',
    name: 'CBRE Capital Markets',
    tier: 1,
    closeRatio: 0.62,
    daysToClose: 142,
    repricingRate: 0.18,
    buyerPoolDepth: 38,
    offMarketShare: 0.41,
  };
  const ea: BrokerProfile = {
    id: 'KF-KE-001',
    name: 'Knight Frank Kenya',
    tier: 2,
    closeRatio: 0.36,
    daysToClose: 240,
    repricingRate: 0.42,
    buyerPoolDepth: 8,
    offMarketShare: 0.27,
  };

  it('produces composite in [0,1]', () => {
    const s = scoreBroker(top);
    expect(s.composite).toBeGreaterThan(0);
    expect(s.composite).toBeLessThanOrEqual(1);
  });

  it('top broker scores higher than EA broker', () => {
    const t = scoreBroker(top);
    const e = scoreBroker(ea);
    expect(t.composite).toBeGreaterThan(e.composite);
  });

  it('rankBrokers sorts descending by composite', () => {
    const r = rankBrokers([ea, top]);
    expect(r[0].broker.id).toBe(top.id);
  });

  it('throws on invalid closeRatio', () => {
    expect(() => scoreBroker({ ...top, closeRatio: 1.5 })).toThrow();
  });
});

describe('scoreOffMarketTrigger', () => {
  it('foreclosure has higher conversion prior than divorce', () => {
    expect(OFF_MARKET_CONVERSION_PRIORS.foreclosure).toBeGreaterThan(
      OFF_MARKET_CONVERSION_PRIORS.divorce,
    );
  });

  it('hot bucket for high evidence + foreclosure', () => {
    const s = scoreOffMarketTrigger({
      type: 'foreclosure',
      ownerId: 'o1',
      detectedAt: Date.now(),
      leadTimeMonths: 2,
      conversionPriorPct: 0.31,
      evidenceConfidence: 0.95,
    });
    expect(s.priorityBand).toBe('hot');
  });

  it('cold bucket for divorce with low evidence', () => {
    const s = scoreOffMarketTrigger({
      type: 'divorce',
      ownerId: 'o2',
      detectedAt: Date.now(),
      leadTimeMonths: 6,
      conversionPriorPct: 0.06,
      evidenceConfidence: 0.4,
    });
    expect(s.priorityBand).toBe('cold');
  });

  it('rankTriggers sorts by expected value', () => {
    const r = rankTriggers([
      { type: 'divorce', ownerId: 'd', detectedAt: 0, leadTimeMonths: 12, conversionPriorPct: 0.06, evidenceConfidence: 0.3 },
      { type: 'foreclosure', ownerId: 'f', detectedAt: 0, leadTimeMonths: 1, conversionPriorPct: 0.31, evidenceConfidence: 0.9 },
    ]);
    expect(r[0].type).toBe('foreclosure');
  });

  it('rejects invalid prior', () => {
    expect(() =>
      scoreOffMarketTrigger({
        type: 'probate',
        ownerId: 'x',
        detectedAt: 0,
        leadTimeMonths: 3,
        conversionPriorPct: 2,
        evidenceConfidence: 0.5,
      }),
    ).toThrow();
  });
});

describe('owner outreach personalizer', () => {
  it('returns template for known archetype', () => {
    const t = getOutreachTemplate('agingBoutique');
    expect(t.subject).toMatch(/estate-planning/);
    expect(t.channel).toBe('handwritten');
  });

  it('EA generational family uses WhatsApp', () => {
    const t = getOutreachTemplate('eaGenerationalFamily');
    expect(t.channel).toBe('whatsapp');
  });

  it('lists 6 templates', () => {
    expect(listOutreachTemplates().length).toBe(6);
  });
});

describe('rent-comp triangulator', () => {
  const filters = {
    maxMonthsAgo: 12,
    maxDistanceMetres: 1200,
    assetClass: 'office' as const,
    subjectSizeSqm: 1500,
    sizeTolerance: 0.3,
  };

  const comps: ComparableLease[] = [
    { id: 'l1', rentPerSqmPerYear: 350, distanceMetres: 400, monthsAgo: 3, sizeSqm: 1500, assetClass: 'office', qualitySimilarity: 0.9, termYears: 5, tenantCovenant: 'IG' },
    { id: 'l2', rentPerSqmPerYear: 380, distanceMetres: 800, monthsAgo: 6, sizeSqm: 1700, assetClass: 'office', qualitySimilarity: 0.85, termYears: 7, tenantCovenant: 'NIG' },
    { id: 'l3', rentPerSqmPerYear: 360, distanceMetres: 600, monthsAgo: 8, sizeSqm: 1400, assetClass: 'office', qualitySimilarity: 0.80, termYears: 5, tenantCovenant: 'IG' },
    { id: 'l4', rentPerSqmPerYear: 900, distanceMetres: 1000, monthsAgo: 4, sizeSqm: 1500, assetClass: 'office', qualitySimilarity: 0.7, termYears: 10, tenantCovenant: 'gov' },
  ];

  it('drops obvious outlier', () => {
    const r = triangulateRents(comps, filters);
    expect(r.droppedOutliers.some((c) => c.id === 'l4')).toBe(true);
  });

  it('weighted median plausible band', () => {
    const r = triangulateRents(comps, filters);
    expect(r.weightedMedianRentPerSqm).toBeGreaterThan(300);
    expect(r.weightedMedianRentPerSqm).toBeLessThan(450);
  });

  it('zero result when nothing matches', () => {
    const r = triangulateRents(comps, { ...filters, assetClass: 'industrial' });
    expect(r.weightedMedianRentPerSqm).toBe(0);
  });
});

describe('computeCapRateDerivative', () => {
  const comps: ComparableSale[] = [
    { id: 'c1', salePricePerSqm: 1000, distanceMetres: 0, monthsAgo: 6, sizeSqm: 1000, assetClass: 'office', qualitySimilarity: 0.8, capRate: 0.075 },
    { id: 'c2', salePricePerSqm: 1100, distanceMetres: 0, monthsAgo: 9, sizeSqm: 1000, assetClass: 'office', qualitySimilarity: 0.85, capRate: 0.080 },
    { id: 'c3', salePricePerSqm: 1050, distanceMetres: 0, monthsAgo: 4, sizeSqm: 1000, assetClass: 'office', qualitySimilarity: 0.90, capRate: 0.082 },
    { id: 'c4', salePricePerSqm: 1200, distanceMetres: 0, monthsAgo: 2, sizeSqm: 1000, assetClass: 'office', qualitySimilarity: 0.95, capRate: 0.078 },
    { id: 'c5', salePricePerSqm: 950, distanceMetres: 0, monthsAgo: 11, sizeSqm: 1000, assetClass: 'office', qualitySimilarity: 0.75, capRate: 0.090 },
  ];

  it('returns trimmed mean within comp range', () => {
    const r = computeCapRateDerivative({ comps, riskFreeRate: 0.045 });
    expect(r.trimmedMean).toBeGreaterThan(0.07);
    expect(r.trimmedMean).toBeLessThan(0.10);
  });

  it('spread is positive in healthy cap-rate environment', () => {
    const r = computeCapRateDerivative({ comps, riskFreeRate: 0.045 });
    expect(r.spreadBps).toBeGreaterThan(0);
  });

  it('handles empty comps', () => {
    const r = computeCapRateDerivative({ comps: [], riskFreeRate: 0.045 });
    expect(r.trimmedMean).toBe(0);
    expect(r.compCount).toBe(0);
  });

  it('rejects invalid trim', () => {
    expect(() =>
      computeCapRateDerivative({ comps, riskFreeRate: 0.045, trimShare: 0.7 }),
    ).toThrow();
  });
});

describe('casualty + condemnation modeler', () => {
  it('threshold dollar is min(5%, $250k)', () => {
    const m = modelCasualtyCondemnation({ purchasePrice: 10_000_000 });
    expect(m.thresholdDollar).toBe(250_000);
    const small = modelCasualtyCondemnation({ purchasePrice: 1_000_000 });
    expect(small.thresholdDollar).toBe(50_000);
  });

  it('buyerMayTerminate respects threshold', () => {
    const m = modelCasualtyCondemnation({ purchasePrice: 5_000_000 });
    expect(buyerMayTerminate(m, 100_000)).toBe(false);
    expect(buyerMayTerminate(m, 300_000)).toBe(true);
  });

  it('honors override threshold pct', () => {
    const m = modelCasualtyCondemnation({
      purchasePrice: 10_000_000,
      thresholdSharePctOverride: 0.10,
    });
    expect(m.thresholdSharePct).toBe(0.10);
  });

  it('rejects bad purchase price', () => {
    expect(() => modelCasualtyCondemnation({ purchasePrice: 0 })).toThrow();
  });
});

describe('ALTA survey reader', () => {
  it('clean survey returns clean verdict', () => {
    const r = readAltaSurvey({
      hasMonuments: true,
      hasFloodZone: true,
      hasZoningSummary: true,
      encroachments: [],
      setbackViolations: [],
    });
    expect(r.verdict).toBe('clean');
  });

  it('material when major encroachment present', () => {
    const r = readAltaSurvey({
      hasMonuments: true,
      hasFloodZone: true,
      hasZoningSummary: true,
      encroachments: [
        {
          id: 'e1',
          direction: 'subjectOntoNeighbor',
          affectedAreaSqm: 50,
          curableAtClose: false,
        },
      ],
      setbackViolations: [],
    });
    expect(['material', 'unworkable']).toContain(r.verdict);
  });

  it('setback violation triggering redevelopment is material', () => {
    const r = readAltaSurvey({
      hasMonuments: true,
      hasFloodZone: true,
      hasZoningSummary: true,
      encroachments: [],
      setbackViolations: [
        {
          id: 's1',
          side: 'front',
          requiredMetres: 5,
          actualMetres: 2,
          grandfathered: true,
          redevelopmentTrigger: true,
        },
      ],
    });
    expect(['material', 'unworkable']).toContain(r.verdict);
  });
});
