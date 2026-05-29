/**
 * tab-suggester detector tests — pure-function locks for the three
 * pattern detectors. Real-estate observation fixtures.
 */

import { describe, expect, it } from 'vitest';

import {
  detectDrillDownRepeat,
  detectMwikilaEscalation,
  detectNavigationLoop,
  type DrillDownObservation,
  type MwikilaObservation,
  type NavigationObservation,
} from '../detectors.js';

const NOW = new Date('2026-05-29T12:00:00Z');
const INPUT = { tenantId: 't1', userId: 'u1', now: NOW } as const;
const HOUR_MS = 60 * 60 * 1000;

describe('detectDrillDownRepeat', () => {
  it('returns null when fewer than 3 drill-downs in the window', () => {
    const obs: DrillDownObservation[] = [
      {
        id: 'a',
        tabType: 'rent',
        focus: 'Mwenge T-23',
        occurredAt: new Date(NOW.getTime() - HOUR_MS),
      },
      {
        id: 'b',
        tabType: 'rent',
        focus: 'Mwenge T-23',
        occurredAt: new Date(NOW.getTime() - 2 * HOUR_MS),
      },
    ];
    expect(detectDrillDownRepeat(INPUT, obs)).toBeNull();
  });

  it('returns a real-estate-flavored proposal on 3+ repeats', () => {
    const obs: DrillDownObservation[] = Array.from({ length: 4 }, (_, i) => ({
      id: `obs-${i}`,
      tabType: 'rent',
      focus: 'Mwenge T-23',
      occurredAt: new Date(NOW.getTime() - i * HOUR_MS),
    }));
    const result = detectDrillDownRepeat(INPUT, obs);
    expect(result).not.toBeNull();
    expect(result!.detector).toBe('drill_down_repeat');
    expect(result!.tabType).toBe('rent');
    expect(result!.titleSw).toContain('Bandika');
    expect(result!.titleEn).toContain('Pin');
    expect(result!.evidenceIds.length).toBeGreaterThanOrEqual(1);
    expect(result!.evidenceIds[0]).toMatch(/^nav:/);
    // 4 repeats -> 0.7 + 1*0.05 = 0.75
    expect(result!.confidence).toBeCloseTo(0.75, 5);
  });

  it('drops observations outside the 7-day window', () => {
    const oldObs: DrillDownObservation[] = Array.from(
      { length: 5 },
      (_, i) => ({
        id: `old-${i}`,
        tabType: 'compliance',
        focus: 'BRELA',
        // 8 days ago, well outside the 7-day window
        occurredAt: new Date(NOW.getTime() - 8 * 24 * HOUR_MS - i * HOUR_MS),
      }),
    );
    expect(detectDrillDownRepeat(INPUT, oldObs)).toBeNull();
  });
});

describe('detectNavigationLoop', () => {
  it('returns null when fewer than 4 visits in 24h', () => {
    const obs: NavigationObservation[] = [
      { id: 'a', route: '/compliance', occurredAt: new Date(NOW.getTime() - HOUR_MS) },
      {
        id: 'b',
        route: '/compliance',
        occurredAt: new Date(NOW.getTime() - 2 * HOUR_MS),
      },
    ];
    expect(detectNavigationLoop(INPUT, obs)).toBeNull();
  });

  it('returns a proposal when the user bounces back to the same real-estate route', () => {
    const obs: NavigationObservation[] = Array.from({ length: 6 }, (_, i) => ({
      id: `obs-${i}`,
      route: '/leases',
      occurredAt: new Date(NOW.getTime() - i * HOUR_MS),
    }));
    const result = detectNavigationLoop(INPUT, obs);
    expect(result).not.toBeNull();
    expect(result!.detector).toBe('navigation_loop');
    expect(result!.tabType).toBe('leases');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('ignores routes outside the known map', () => {
    const obs: NavigationObservation[] = Array.from({ length: 5 }, (_, i) => ({
      id: `obs-${i}`,
      route: '/unknown-route',
      occurredAt: new Date(NOW.getTime() - i * HOUR_MS),
    }));
    expect(detectNavigationLoop(INPUT, obs)).toBeNull();
  });

  it('maps prefix routes (e.g. /compliance/licences) to the right tab', () => {
    const obs: NavigationObservation[] = Array.from({ length: 5 }, (_, i) => ({
      id: `obs-${i}`,
      route: '/compliance/licences',
      occurredAt: new Date(NOW.getTime() - i * HOUR_MS),
    }));
    const result = detectNavigationLoop(INPUT, obs);
    expect(result?.tabType).toBe('licences');
  });
});

describe('detectMwikilaEscalation', () => {
  it('returns null when there are fewer than 2 T0/T1 escalations', () => {
    const obs: MwikilaObservation[] = [
      {
        id: 'a',
        category: 'compliance',
        tier: 'T1',
        occurredAt: new Date(NOW.getTime() - HOUR_MS),
      },
    ];
    expect(detectMwikilaEscalation(INPUT, obs)).toBeNull();
  });

  it('returns a proposal when 2+ T0/T1 escalations share a category', () => {
    const obs: MwikilaObservation[] = [
      {
        id: 'a',
        category: 'rent',
        tier: 'T0',
        occurredAt: new Date(NOW.getTime() - HOUR_MS),
      },
      {
        id: 'b',
        category: 'rent',
        tier: 'T1',
        occurredAt: new Date(NOW.getTime() - 2 * HOUR_MS),
      },
      {
        id: 'c',
        category: 'rent',
        tier: 'T1',
        occurredAt: new Date(NOW.getTime() - 3 * HOUR_MS),
      },
    ];
    const result = detectMwikilaEscalation(INPUT, obs);
    expect(result).not.toBeNull();
    expect(result!.detector).toBe('mwikila_escalation');
    expect(result!.tabType).toBe('rent');
    expect(result!.evidenceIds[0]).toMatch(/^mwa:/);
    expect(result!.reasonSw).toContain('Mr. Mwikila');
    expect(result!.reasonEn).toContain('Mr. Mwikila');
  });

  it('ignores T2/T3 escalations (only T0/T1 raise the bar)', () => {
    const obs: MwikilaObservation[] = [
      {
        id: 'a',
        category: 'compliance',
        tier: 'T2',
        occurredAt: new Date(NOW.getTime() - HOUR_MS),
      },
      {
        id: 'b',
        category: 'compliance',
        tier: 'T3',
        occurredAt: new Date(NOW.getTime() - 2 * HOUR_MS),
      },
    ];
    expect(detectMwikilaEscalation(INPUT, obs)).toBeNull();
  });
});
