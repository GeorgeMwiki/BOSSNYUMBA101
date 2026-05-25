import { describe, expect, it } from 'vitest';
import {
  recommendDeliveryMethod,
  scoreGCBids,
  selectGC,
} from '../development/gc-selector.js';
import type { GCBid, ProjectAttributes } from '../types.js';

const baseBids: ReadonlyArray<GCBid> = [
  {
    contractorId: 'GC-A',
    name: 'Acme',
    trackRecord: 0.95,
    teamStrength: 0.90,
    scheduleRealism: 0.85,
    price: 105_000_000,
    lowestBidPrice: 100_000_000,
    dartRate: 1.0,
    localHireScore: 0.7,
  },
  {
    contractorId: 'GC-B',
    name: 'Bravo',
    trackRecord: 0.50,
    teamStrength: 0.60,
    scheduleRealism: 0.80,
    price: 100_000_000,
    lowestBidPrice: 100_000_000,
    dartRate: 2.5,
    localHireScore: 0.5,
  },
  {
    contractorId: 'GC-C',
    name: 'Charlie',
    trackRecord: 0.80,
    teamStrength: 0.75,
    scheduleRealism: 0.90,
    price: 108_000_000,
    lowestBidPrice: 100_000_000,
    dartRate: 1.2,
    localHireScore: 0.9,
  },
];

describe('gc-selector: delivery method', () => {
  it('recommends IPD for extreme complexity + low risk tolerance', () => {
    const attrs: ProjectAttributes = {
      complexity: 'extreme',
      drawingsCompletePct: 0.95,
      speedRequired: 'normal',
      innovationLevel: 'custom',
      riskTolerance: 'low',
    };
    expect(recommendDeliveryMethod(attrs).method).toBe('ipd');
  });

  it('recommends design-build for first-of-kind', () => {
    const attrs: ProjectAttributes = {
      complexity: 'high',
      drawingsCompletePct: 0.95,
      speedRequired: 'fast-track',
      innovationLevel: 'first-of-kind',
      riskTolerance: 'medium',
    };
    expect(recommendDeliveryMethod(attrs).method).toBe('design-build');
  });

  it('recommends CMAR for fast-track', () => {
    const attrs: ProjectAttributes = {
      complexity: 'medium',
      drawingsCompletePct: 0.75,
      speedRequired: 'fast-track',
      innovationLevel: 'standard',
      riskTolerance: 'medium',
    };
    expect(recommendDeliveryMethod(attrs).method).toBe('cmar');
  });

  it('defaults to DBB for standard low-complexity', () => {
    const attrs: ProjectAttributes = {
      complexity: 'low',
      drawingsCompletePct: 1.0,
      speedRequired: 'normal',
      innovationLevel: 'standard',
      riskTolerance: 'medium',
    };
    expect(recommendDeliveryMethod(attrs).method).toBe('design-bid-build');
  });
});

describe('gc-selector: bid scoring', () => {
  it('ranks bids by qualifications-weighted total', () => {
    const ranked = scoreGCBids(baseBids);
    expect(ranked).toHaveLength(3);
    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[0]!.contractorId).toBe('GC-A');
  });

  it('penalises high DART (poor safety)', () => {
    const ranked = scoreGCBids(baseBids);
    const bravo = ranked.find((r) => r.contractorId === 'GC-B')!;
    const acme = ranked.find((r) => r.contractorId === 'GC-A')!;
    expect(bravo.safetyScore).toBeLessThan(acme.safetyScore);
  });

  it('selectGC returns recommended + method', () => {
    const sel = selectGC(
      {
        complexity: 'low',
        drawingsCompletePct: 1.0,
        speedRequired: 'normal',
        innovationLevel: 'standard',
        riskTolerance: 'medium',
      },
      baseBids,
    );
    expect(sel.method).toBe('design-bid-build');
    expect(sel.recommended.contractorId).toBe('GC-A');
    expect(sel.rankedBids).toHaveLength(3);
  });

  it('throws when no bids supplied', () => {
    expect(() => selectGC({
      complexity: 'low',
      drawingsCompletePct: 1,
      speedRequired: 'normal',
      innovationLevel: 'standard',
      riskTolerance: 'medium',
    }, [])).toThrow();
  });
});
