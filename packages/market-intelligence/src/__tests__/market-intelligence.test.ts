/**
 * Market Intelligence tests.
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateInternal,
  createPlaceholderFeed,
  createMarketDataService,
  findComparables,
  seasonalityMultiplier,
  applySeasonality,
  getSeasonalityTable,
  type UnitObservation,
} from '../index.js';

const asOf = '2026-04-19T10:00:00Z';

function obs(overrides: Partial<UnitObservation> = {}): UnitObservation {
  return {
    unitId: overrides.unitId ?? 'u-1',
    tenantId: overrides.tenantId ?? 't-1',
    districtId: overrides.districtId ?? 'kinondoni',
    countryCode: overrides.countryCode ?? 'TZA',
    unitType: overrides.unitType ?? '1br',
    areaSqft: overrides.areaSqft ?? 500,
    monthlyRentKes: overrides.monthlyRentKes,
    monthlyRentTzs: overrides.monthlyRentTzs ?? 500000,
    isOccupied: overrides.isOccupied ?? true,
    yearBuilt: overrides.yearBuilt ?? 2020,
    observedAt: overrides.observedAt ?? asOf,
  };
}

describe('Internal aggregator', () => {
  it('computes vacancy rate', () => {
    const result = aggregateInternal({
      observations: [
        obs({ unitId: 'a', isOccupied: true }),
        obs({ unitId: 'b', isOccupied: false }),
        obs({ unitId: 'c', isOccupied: true }),
        obs({ unitId: 'd', isOccupied: false }),
      ],
      asOf,
    });
    expect(result[0]?.vacancyRatePct).toBe(50);
  });

  it('produces metrics per district', () => {
    const result = aggregateInternal({
      observations: [
        obs({ unitId: 'a', districtId: 'kinondoni' }),
        obs({ unitId: 'b', districtId: 'ilala' }),
      ],
      asOf,
    });
    expect(result.length).toBe(2);
  });

  it('handles empty observations', () => {
    const result = aggregateInternal({ observations: [], asOf });
    expect(result.length).toBe(0);
  });

  it('includes sample size', () => {
    const result = aggregateInternal({
      observations: [obs({ unitId: 'a' }), obs({ unitId: 'b' })],
      asOf,
    });
    expect(result[0]?.sampleSize).toBe(2);
  });
});

describe('Seasonality', () => {
  it('TZA January is above mean', () => {
    expect(seasonalityMultiplier('TZA', 1)).toBeGreaterThan(1.0);
  });

  it('TZA May is below mean', () => {
    expect(seasonalityMultiplier('TZA', 5)).toBeLessThan(1.0);
  });

  it('KEN matches similar pattern', () => {
    expect(seasonalityMultiplier('KEN', 1)).toBeGreaterThan(1.0);
  });

  it('unknown country returns 1.0', () => {
    expect(seasonalityMultiplier('ZZZ', 1)).toBe(1.0);
  });

  it('applies multiplier', () => {
    const adjusted = applySeasonality(1000, 'TZA', 1);
    expect(adjusted).toBeGreaterThan(1000);
  });

  it('returns full table for country', () => {
    expect(getSeasonalityTable('TZA').length).toBe(12);
  });
});

describe('Comparable finder', () => {
  const target = obs({ unitId: 'target', unitType: '2br', areaSqft: 800, yearBuilt: 2018 });
  const pool: UnitObservation[] = [
    obs({ unitId: 'same-district', districtId: 'kinondoni', unitType: '2br', areaSqft: 810, yearBuilt: 2019 }),
    obs({ unitId: 'different-district', districtId: 'ilala', unitType: '2br', areaSqft: 820, yearBuilt: 2020 }),
    obs({ unitId: 'different-type', districtId: 'kinondoni', unitType: 'shop', areaSqft: 800 }),
  ];

  it('returns most similar first', () => {
    const result = findComparables({ targetUnit: target, pool });
    expect(result[0]?.unitId).toBe('same-district');
  });

  it('respects maxResults', () => {
    const result = findComparables({ targetUnit: target, pool, maxResults: 2 });
    expect(result.length).toBe(2);
  });

  it('excludes target', () => {
    const result = findComparables({ targetUnit: target, pool });
    expect(result.find((r) => r.unitId === 'target')).toBeUndefined();
  });
});

describe('Market data service', () => {
  it('aggregates internal observations', async () => {
    const svc = createMarketDataService();
    const result = await svc.queryDistrictMetrics({
      countryCode: 'TZA',
      asOf,
      observations: [obs({ unitId: 'a' }), obs({ unitId: 'b' })],
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it('filters by country code', async () => {
    const svc = createMarketDataService();
    const result = await svc.queryDistrictMetrics({
      countryCode: 'KEN',
      asOf,
      observations: [obs({ unitId: 'a', countryCode: 'TZA' })],
    });
    expect(result.length).toBe(0);
  });

  it('merges with external feed', async () => {
    const svc = createMarketDataService({
      externalFeeds: [createPlaceholderFeed()],
    });
    const result = await svc.queryDistrictMetrics({
      countryCode: 'TZA',
      asOf,
      observations: [obs({ unitId: 'a' })],
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it('applies seasonality when enabled', async () => {
    const svc = createMarketDataService({ applySeasonality: true });
    const withSeason = await svc.queryDistrictMetrics({
      countryCode: 'TZA',
      asOf,
      month: 1,
      observations: [obs({ unitId: 'a', monthlyRentTzs: 500000, areaSqft: 500 })],
    });
    const withoutSeason = await svc.queryDistrictMetrics({
      countryCode: 'TZA',
      asOf,
      observations: [obs({ unitId: 'a', monthlyRentTzs: 500000, areaSqft: 500 })],
    });
    expect(withSeason[0]?.rentPerSqftTzs).toBeGreaterThan(
      withoutSeason[0]?.rentPerSqftTzs ?? 0,
    );
  });
});
