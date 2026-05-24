import { describe, expect, it } from 'vitest';
import { scoreChangeOrderRisk } from '../development/change-order-risk-scorer.js';
import type { ChangeOrderRiskInputs } from '../types.js';

const wellRun: ChangeOrderRiskInputs = {
  designCompleteness: 1.0,
  scopeDiscipline: 0.95,
  preBidGeotech: true,
  peerReviewedCD: true,
  bimLevel: 2,
  bondedLargeTrades: true,
  weatherModelInUse: true,
  committedAtP80: true,
  specBackupsPresent: true,
  labourLocksInPlace: true,
  ofeScheduleAudited: true,
  thirdPartyQA: true,
};

const poorlyRun: ChangeOrderRiskInputs = {
  designCompleteness: 0.40,
  scopeDiscipline: 0.30,
  preBidGeotech: false,
  peerReviewedCD: false,
  bimLevel: 0,
  bondedLargeTrades: false,
  weatherModelInUse: false,
  committedAtP80: false,
  specBackupsPresent: false,
  labourLocksInPlace: false,
  ofeScheduleAudited: false,
  thirdPartyQA: false,
};

describe('change-order-risk-scorer', () => {
  it('well-run project has lower total expected CO impact than poorly-run', () => {
    const a = scoreChangeOrderRisk(wellRun);
    const b = scoreChangeOrderRisk(poorlyRun);
    expect(a.totalExpectedCOImpactPct).toBeLessThan(b.totalExpectedCOImpactPct);
  });

  it('returns 12 per-cause entries', () => {
    const r = scoreChangeOrderRisk(wellRun);
    expect(r.perCauseRisk).toHaveLength(12);
  });

  it('top-3 always returned even in well-run case', () => {
    const r = scoreChangeOrderRisk(wellRun);
    expect(r.top3Causes).toHaveLength(3);
  });

  it('owner-scope-change appears in poorly-run top-3', () => {
    const r = scoreChangeOrderRisk(poorlyRun);
    expect(r.top3Causes).toContain('owner-scope-change');
  });

  it('probabilities clamp to [0,1]', () => {
    const r = scoreChangeOrderRisk(wellRun);
    for (const entry of r.perCauseRisk) {
      expect(entry.probabilityOfOccurrence).toBeGreaterThanOrEqual(0);
      expect(entry.probabilityOfOccurrence).toBeLessThanOrEqual(1);
    }
  });

  it('risk-weighted impact = probability × median', () => {
    const r = scoreChangeOrderRisk(wellRun);
    for (const entry of r.perCauseRisk) {
      expect(entry.riskWeightedImpactPct).toBeCloseTo(
        entry.probabilityOfOccurrence * entry.medianImpactPct,
        9,
      );
    }
  });
});
