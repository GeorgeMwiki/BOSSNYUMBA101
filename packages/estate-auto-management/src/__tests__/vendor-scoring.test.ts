import { describe, expect, it } from 'vitest';
import { bidExtremes, syntheticBids } from '../vendor/vendor-bidder.js';
import { scoreVendor } from '../vendor/vendor-scorer.js';
import { selectVendor } from '../vendor/vendor-selector.js';
import type { VendorProfile } from '../types.js';

const vendors: VendorProfile[] = [
  { id: 'v1', name: 'AlphaServ', family: 'hvac', medianJobPrice: 1000, medianResponseHours: 24, reworkRate: 0.05, distanceKm: 5, compliant: true, available: true },
  { id: 'v2', name: 'BetaServ', family: 'hvac', medianJobPrice: 900, medianResponseHours: 36, reworkRate: 0.10, distanceKm: 12, compliant: true, available: true },
  { id: 'v3', name: 'GammaServ', family: 'hvac', medianJobPrice: 800, medianResponseHours: 48, reworkRate: 0.20, distanceKm: 30, compliant: true, available: false },
  { id: 'v4', name: 'DeltaServ', family: 'hvac', medianJobPrice: 700, medianResponseHours: 12, reworkRate: 0.04, distanceKm: 8, compliant: false, available: true },
];

describe('vendor-bidder', () => {
  it('filters to compliant + available vendors', () => {
    const bids = syntheticBids(vendors);
    expect(bids.length).toBe(2);
    expect(bids.map((b) => b.vendorId)).toEqual(['v1', 'v2']);
  });

  it('applies price + response bias', () => {
    const bids = syntheticBids([vendors[0]], { priceBias: -0.10, responseBias: -0.20 });
    expect(bids[0].quotedPrice).toBeCloseTo(900);
    expect(bids[0].quotedResponseHours).toBeCloseTo(19.2);
  });

  it('returns extremes correctly', () => {
    const bids = syntheticBids(vendors);
    const x = bidExtremes(bids);
    expect(x.bestPrice).toBe(900);
    expect(x.bestResponseHours).toBe(24);
  });

  it('handles empty bid list', () => {
    const x = bidExtremes([]);
    expect(x.bestPrice).toBe(0);
  });
});

describe('vendor-scorer', () => {
  it('full score for ideal vendor', () => {
    const s = scoreVendor({
      vendor: vendors[0],
      bestPrice: 1000,
      bestResponseHours: 24,
    });
    expect(s.priceScore).toBe(1);
    expect(s.responseScore).toBe(1);
    expect(s.qualityScore).toBeCloseTo(0.95);
    expect(s.complianceScore).toBe(1);
    expect(s.total).toBeGreaterThan(0.7);
  });

  it('non-compliant vendor scores 0 on compliance', () => {
    const s = scoreVendor({
      vendor: vendors[3],
      bestPrice: 700,
      bestResponseHours: 12,
    });
    expect(s.complianceScore).toBe(0);
  });
});

describe('vendor-selector', () => {
  it('picks the best available compliant vendor', () => {
    const sel = selectVendor({ vendors });
    expect(sel.selected?.vendorId).toBe('v1');
  });

  it('skips unavailable vendors', () => {
    const sel = selectVendor({
      vendors: [{ ...vendors[0], available: false }, vendors[1]],
    });
    expect(sel.selected?.vendorId).toBe('v2');
  });

  it('returns reason when nothing is selectable', () => {
    const sel = selectVendor({
      vendors: [{ ...vendors[3] }],
    });
    expect(sel.selected).toBeUndefined();
    expect(sel.reason).toMatch(/no compliant vendor/);
  });

  it('uses bids when provided', () => {
    const bids = syntheticBids(vendors, { priceBias: -0.5 });
    const sel = selectVendor({ vendors, bids });
    expect(sel.ranked.length).toBeGreaterThan(0);
  });
});
