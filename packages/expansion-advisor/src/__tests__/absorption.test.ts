import { describe, expect, it } from 'vitest';
import { forecastAbsorption } from '../market/absorption-forecaster.js';

describe('absorption-forecaster', () => {
  it('rejects non-positive monthly absorption', () => {
    expect(() =>
      forecastAbsorption({
        market: {
          assetClass: 'multifamily',
          subMarket: 'Kileleshwa',
          activeInventoryUnits: 200,
          monthlyAbsorptionUnits: 0,
          comparableRentPerSqm: 20,
          comparableSalePsfPerSqm: 1800,
          capRate: 0.085,
        },
        newSupplyUnits: 100,
        horizonMonths: 24,
      }),
    ).toThrow(/monthlyAbsorptionUnits/);
  });

  it('rejects very short horizons', () => {
    expect(() =>
      forecastAbsorption({
        market: {
          assetClass: 'multifamily',
          subMarket: 'X',
          activeInventoryUnits: 100,
          monthlyAbsorptionUnits: 10,
          comparableRentPerSqm: 20,
          comparableSalePsfPerSqm: 1800,
          capRate: 0.085,
        },
        newSupplyUnits: 50,
        horizonMonths: 1,
      }),
    ).toThrow();
  });

  it('returns a monotonic curve to 1.0', () => {
    const r = forecastAbsorption({
      market: {
        assetClass: 'industrial',
        subMarket: 'Athi River',
        activeInventoryUnits: 50,
        monthlyAbsorptionUnits: 10,
        comparableRentPerSqm: 6,
        comparableSalePsfPerSqm: 900,
        capRate: 0.10,
      },
      newSupplyUnits: 100,
      horizonMonths: 48,
    });
    for (let i = 1; i < r.curve.length; i += 1) {
      expect(r.curve[i].p).toBeGreaterThanOrEqual(r.curve[i - 1].p);
    }
    expect(r.curve[r.curve.length - 1].p).toBeGreaterThan(0.9);
  });

  it('computes mos = (inventory + new) / monthly absorption', () => {
    const r = forecastAbsorption({
      market: {
        assetClass: 'office',
        subMarket: 'Westlands',
        activeInventoryUnits: 100,
        monthlyAbsorptionUnits: 10,
        comparableRentPerSqm: 25,
        comparableSalePsfPerSqm: 2500,
        capRate: 0.10,
      },
      newSupplyUnits: 100,
      horizonMonths: 24,
    });
    expect(r.mos).toBeCloseTo(20, 4);
  });

  it('returns velocity equal to monthly absorption', () => {
    const r = forecastAbsorption({
      market: {
        assetClass: 'retail',
        subMarket: 'Karen',
        activeInventoryUnits: 50,
        monthlyAbsorptionUnits: 12,
        comparableRentPerSqm: 30,
        comparableSalePsfPerSqm: 3000,
        capRate: 0.085,
      },
      newSupplyUnits: 36,
      horizonMonths: 24,
    });
    expect(r.velocity).toBe(12);
  });
});
