import { describe, it, expect } from 'vitest';
import {
  adviseVendorPortfolio,
  CONCENTRATION_CAP,
  RFP_TRIGGER,
  RECOMMENDED_STRUCTURE,
  __test__,
} from '../vendor/vendor-portfolio-advisor.js';
import { TENANT_ID } from './fixtures.js';
import type { VendorSpend } from '../types.js';

const baseVendor = (over: Partial<VendorSpend>): VendorSpend => ({
  vendorId: 'v',
  vendorName: 'Vendor',
  category: 'janitorial',
  annualSpendUsd: 100_000,
  contractType: 'fixed-bid',
  responseTimeP50Hours: 12,
  firstTimeFixRate: 0.85,
  costVariancePct: 0.04,
  qualityScore: 4.2,
  contractEndsAtMs: Date.now() + 90 * 24 * 60 * 60 * 1000,
  ...over,
});

describe('vendor-portfolio-advisor', () => {
  it('flags critical concentration at 100% single vendor', () => {
    const r = adviseVendorPortfolio({
      tenantId: TENANT_ID,
      vendors: [baseVendor({ vendorId: 'solo', annualSpendUsd: 500_000 })],
    });
    const crit = r.recommendations.find((x) => x.id.startsWith('vendor.conc.crit'));
    expect(crit).toBeDefined();
  });

  it('flags high concentration between 25% and 40%', () => {
    const r = adviseVendorPortfolio({
      tenantId: TENANT_ID,
      vendors: [
        baseVendor({ vendorId: 'a', annualSpendUsd: 35 }),
        baseVendor({ vendorId: 'b', annualSpendUsd: 35 }),
        baseVendor({ vendorId: 'c', annualSpendUsd: 30 }),
      ],
    });
    // Top vendor 35/100 = 35% — between cap and RFP-trigger.
    const high = r.recommendations.find((x) => x.id.startsWith('vendor.conc.high'));
    expect(high).toBeDefined();
  });

  it('CONCENTRATION_CAP < RFP_TRIGGER', () => {
    expect(CONCENTRATION_CAP).toBeLessThan(RFP_TRIGGER);
  });

  it('emits KPI breach when first-time fix below floor', () => {
    const r = adviseVendorPortfolio({
      tenantId: TENANT_ID,
      vendors: [baseVendor({ firstTimeFixRate: 0.5 })],
    });
    const kpi = r.kpiBreaches.find((b) => b.breach.includes('First-time fix'));
    expect(kpi).toBeDefined();
  });

  it('emits KPI breach for quality < 4.0', () => {
    const r = adviseVendorPortfolio({
      tenantId: TENANT_ID,
      vendors: [baseVendor({ qualityScore: 3.0 })],
    });
    expect(r.kpiBreaches.find((b) => b.breach.includes('Quality'))).toBeDefined();
  });

  it('contract mismatch surfaced when actual differs from recommended structure', () => {
    const r = adviseVendorPortfolio({
      tenantId: TENANT_ID,
      vendors: [baseVendor({ contractType: 'hourly' })],
    });
    expect(r.contractMismatch.length).toBeGreaterThan(0);
  });

  it('RECOMMENDED_STRUCTURE covers all vendor categories', () => {
    const cats = Object.keys(RECOMMENDED_STRUCTURE);
    expect(cats.length).toBeGreaterThanOrEqual(13);
  });

  it('topShare returns 0 on empty', () => {
    const out = __test__.topShare([], 'janitorial');
    expect(out.sharePct).toBe(0);
  });

  it('cost-variance > 8% raises breach', () => {
    const r = adviseVendorPortfolio({
      tenantId: TENANT_ID,
      vendors: [baseVendor({ costVariancePct: 0.20 })],
    });
    expect(r.kpiBreaches.find((b) => b.breach.includes('Cost variance'))).toBeDefined();
  });
});
