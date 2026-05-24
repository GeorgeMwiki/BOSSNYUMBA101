import { describe, it, expect } from 'vitest';
import {
  optimizeTenantMix,
  __test__,
} from '../portfolio/tenant-mix-optimizer.js';
import { NOW_MS, TENANT_ID } from './fixtures.js';

describe('tenant-mix-optimizer', () => {
  it('flags critical anchor risk when single tenant > 50%', () => {
    const r = optimizeTenantMix({
      tenantId: TENANT_ID,
      tenants: [
        { tenantName: 'Anchor', annualRentUsd: 600, leaseEndsAtMs: NOW_MS + 365 * 24 * 60 * 60 * 1000, covenantClass: 'investment-grade' },
        { tenantName: 'Small', annualRentUsd: 400, leaseEndsAtMs: NOW_MS + 365 * 24 * 60 * 60 * 1000, covenantClass: 'sme' },
      ],
      nowMs: NOW_MS,
    });
    expect(r.recommendations.find((rec) => rec.id === 'mix.anchor.must-act')).toBeDefined();
  });

  it('flags high anchor flag between 35% and 50%', () => {
    const r = optimizeTenantMix({
      tenantId: TENANT_ID,
      tenants: [
        { tenantName: 'A', annualRentUsd: 40, leaseEndsAtMs: NOW_MS + 365 * 24 * 60 * 60 * 1000, covenantClass: 'middle-market' },
        { tenantName: 'B', annualRentUsd: 30, leaseEndsAtMs: NOW_MS + 730 * 24 * 60 * 60 * 1000, covenantClass: 'middle-market' },
        { tenantName: 'C', annualRentUsd: 30, leaseEndsAtMs: NOW_MS + 1095 * 24 * 60 * 60 * 1000, covenantClass: 'middle-market' },
      ],
      nowMs: NOW_MS,
    });
    expect(r.recommendations.find((rec) => rec.id === 'mix.anchor.flag')).toBeDefined();
  });

  it('government covenant gets 2x weight', () => {
    expect(__test__.COVENANT_WEIGHTS.government).toBe(2.0);
  });

  it('returns empty on zero tenants', () => {
    const r = optimizeTenantMix({
      tenantId: TENANT_ID,
      tenants: [],
      nowMs: NOW_MS,
    });
    expect(r.weightedCovenantScore).toBe(0);
    expect(r.recommendations).toEqual([]);
  });

  it('flags weak covenant when weighted score < 0.7', () => {
    const r = optimizeTenantMix({
      tenantId: TENANT_ID,
      tenants: [
        { tenantName: 'A', annualRentUsd: 100, leaseEndsAtMs: NOW_MS + 365 * 24 * 60 * 60 * 1000, covenantClass: 'sme' },
      ],
      nowMs: NOW_MS,
    });
    expect(r.recommendations.find((rec) => rec.id === 'mix.covenant.weak')).toBeDefined();
  });

  it('flags lease-roll concentration when > 25% in a single year', () => {
    const r = optimizeTenantMix({
      tenantId: TENANT_ID,
      tenants: [
        { tenantName: 'A', annualRentUsd: 60, leaseEndsAtMs: NOW_MS + 365 * 24 * 60 * 60 * 1000, covenantClass: 'middle-market' },
        { tenantName: 'B', annualRentUsd: 20, leaseEndsAtMs: NOW_MS + 730 * 24 * 60 * 60 * 1000, covenantClass: 'middle-market' },
        { tenantName: 'C', annualRentUsd: 20, leaseEndsAtMs: NOW_MS + 1095 * 24 * 60 * 60 * 1000, covenantClass: 'middle-market' },
      ],
      nowMs: NOW_MS,
    });
    expect(r.recommendations.find((rec) => rec.id.startsWith('mix.roll'))).toBeDefined();
  });
});
