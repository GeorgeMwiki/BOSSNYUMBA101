import { describe, it, expect } from 'vitest';
import {
  REGULATORY_CALENDAR,
  upcomingFilings,
  listEntriesByJurisdiction,
  __test__,
} from '../regulatory/jurisdictional-calendar.js';
import { scanCompliance } from '../regulatory/compliance-scanner.js';
import { makePortfolio, NOW_MS } from './fixtures.js';

describe('jurisdictional-calendar', () => {
  it('covers 6 EA jurisdictions + ZA (no US in default seed)', () => {
    const ja = new Set(REGULATORY_CALENDAR.map((e) => e.jurisdiction));
    expect(ja.has('KE')).toBe(true);
    expect(ja.has('TZ')).toBe(true);
    expect(ja.has('UG')).toBe(true);
    expect(ja.has('NG')).toBe(true);
    expect(ja.has('RW')).toBe(true);
    expect(ja.has('ZA')).toBe(true);
  });

  it('listEntriesByJurisdiction returns KE filings', () => {
    const ke = listEntriesByJurisdiction('KE');
    expect(ke.length).toBeGreaterThan(0);
    expect(ke.every((e) => e.jurisdiction === 'KE')).toBe(true);
  });

  it('upcomingFilings horizon filters out events beyond range', () => {
    const result = upcomingFilings({
      jurisdictions: ['KE'],
      nowMs: NOW_MS,
      horizonDays: 10,
    });
    expect(result.every((u) => u.daysUntilDue <= 10)).toBe(true);
  });

  it('upcomingFilings respects sort order', () => {
    const result = upcomingFilings({
      jurisdictions: ['KE', 'TZ'],
      nowMs: NOW_MS,
      horizonDays: 365,
    });
    for (let i = 1; i < result.length; i += 1) {
      expect((result[i]?.daysUntilDue ?? 0)).toBeGreaterThanOrEqual(result[i - 1]?.daysUntilDue ?? 0);
    }
  });

  it('compliance scanner emits recommendations within horizon', () => {
    const r = scanCompliance({
      portfolio: makePortfolio(),
      horizonDays: 120,
      nowMs: NOW_MS,
    });
    expect(r.recommendations.length).toBeGreaterThan(0);
  });

  it('nextDueDateMs returns valid timestamp for annual entry', () => {
    const entry = REGULATORY_CALENDAR.find((e) => e.cadence === 'annual');
    if (!entry) throw new Error('no annual entry');
    const due = __test__.nextDueDateMs(entry, NOW_MS);
    expect(due).toBeGreaterThanOrEqual(NOW_MS);
  });

  it('per-event cadence does not have meaningful due date', () => {
    const entry = REGULATORY_CALENDAR.find((e) => e.cadence === 'per-event');
    if (!entry) throw new Error('no per-event entry');
    const due = __test__.nextDueDateMs(entry, NOW_MS);
    expect(due).toBe(NOW_MS);
  });

  it('every entry has a citation', () => {
    for (const e of REGULATORY_CALENDAR) {
      expect(e.citation.length).toBeGreaterThan(0);
    }
  });
});
