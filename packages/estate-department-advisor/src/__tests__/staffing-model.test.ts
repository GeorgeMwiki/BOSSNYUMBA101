import { describe, it, expect } from 'vitest';
import {
  adviseStaffing,
  MF_STAFFING_BANDS,
  SPAN_OF_CONTROL,
  __test__,
} from '../org/staffing-model-advisor.js';
import { makePortfolio } from './fixtures.js';

describe('staffing-model-advisor', () => {
  it('returns current + target ratios for multifamily focus', () => {
    const r = adviseStaffing({ portfolio: makePortfolio(), assetClassFocus: 'multifamily' });
    expect(r.targetDoorsPerPmFte).toBeGreaterThan(0);
  });

  it('emits over-stretched rec when ratio exceeds band', () => {
    const portfolio = makePortfolio({
      fteHeadcount: makePortfolio().fteHeadcount.map((h) =>
        h.role === 'property-manager' ? { ...h, fte: 0.5 } : h,
      ),
    });
    const r = adviseStaffing({ portfolio, assetClassFocus: 'multifamily' });
    const overRec = r.recommendations.find((x) => x.id === 'staff.pm.overstretched');
    expect(overRec).toBeDefined();
  });

  it('span-of-control flags raised when FTE per role exceeds Deloitte caps', () => {
    const portfolio = makePortfolio({
      fteHeadcount: [
        { role: 'property-manager', fte: 12, avgSalaryUsd: 38_000, avgBonusPct: 0.10, avgTenureMonths: 24 },
        ...makePortfolio().fteHeadcount.filter((h) => h.role !== 'property-manager'),
      ],
    });
    const r = adviseStaffing({ portfolio, assetClassFocus: 'multifamily' });
    expect(r.spanOfControlFlags.length).toBeGreaterThan(0);
  });

  it('MF bands are monotonic — high-rise tighter than affordable', () => {
    expect(MF_STAFFING_BANDS['high-rise']?.doorsPerPmMax).toBeLessThan(MF_STAFFING_BANDS.affordable?.doorsPerPmMax ?? Infinity);
  });

  it('SPAN_OF_CONTROL caps director-ops at 7', () => {
    expect(SPAN_OF_CONTROL['director-ops']).toBe(7);
  });

  it('classifyMfBand chooses high-rise for small doors', () => {
    expect(__test__.classifyMfBand(40, 'multifamily')).toBe('high-rise');
    expect(__test__.classifyMfBand(150, 'multifamily')).toBe('mid-rise');
    expect(__test__.classifyMfBand(500, 'multifamily')).toBe('garden');
  });

  it('office focus returns office band targets', () => {
    const r = adviseStaffing({ portfolio: makePortfolio(), assetClassFocus: 'office' });
    expect(r.targetDoorsPerPmFte).toBeGreaterThan(0);
  });

  it('returns empty recs for ideal staffing ratios', () => {
    // Construct an "ideal" portfolio: 0 doors → no MF coverage tests fire.
    const portfolio = makePortfolio({
      properties: [],
      fteHeadcount: makePortfolio().fteHeadcount,
    });
    const r = adviseStaffing({ portfolio, assetClassFocus: 'multifamily' });
    expect(r.recommendations).toEqual([]);
  });
});
