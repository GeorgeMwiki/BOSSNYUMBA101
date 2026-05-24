/**
 * Absorption forecaster — months-of-supply, velocity, and a
 * logistic absorption curve fit to comparable subMarkets.
 */

import type { AbsorptionForecast, AssetClass, MarketSnapshot } from '../types.js';

export interface AbsorptionInputs {
  readonly market: MarketSnapshot;
  /** Planned new supply (units) added across the forecast window. */
  readonly newSupplyUnits: number;
  readonly horizonMonths: number;
}

export function forecastAbsorption(input: AbsorptionInputs): AbsorptionForecast {
  const { market, newSupplyUnits, horizonMonths } = input;
  if (market.monthlyAbsorptionUnits <= 0) {
    throw new Error('absorption: monthlyAbsorptionUnits must be positive');
  }
  if (horizonMonths < 6) {
    throw new Error('absorption: horizonMonths must be >= 6');
  }

  const totalNew = newSupplyUnits;
  const k = curveSteepness(market.assetClass);
  const t0 = monthsTo50(totalNew, market.monthlyAbsorptionUnits);
  const curve: Array<{ t: number; p: number }> = [];
  for (let t = 0; t <= horizonMonths; t += 1) {
    const p = 1 / (1 + Math.exp(-k * (t - t0)));
    curve.push({ t, p });
  }

  const mos = (market.activeInventoryUnits + totalNew) / market.monthlyAbsorptionUnits;
  const velocity = market.monthlyAbsorptionUnits;
  const leaseUpMonthsTo95 = solveForP(0.95, k, t0);

  return {
    subMarket: market.subMarket,
    assetClass: market.assetClass,
    mos,
    velocity,
    curve,
    leaseUpMonthsTo95,
  };
}

function curveSteepness(c: AssetClass): number {
  switch (c) {
    case 'multifamily':
      return 0.35;
    case 'industrial':
      return 0.45;
    case 'office':
      return 0.18;
    case 'retail':
      return 0.25;
    case 'mixed-use':
      return 0.28;
    case 'land':
      return 0.12;
  }
}

function monthsTo50(totalNew: number, monthlyAbs: number): number {
  if (totalNew <= 0) return 1;
  // Half-supply / monthly absorption + a fixed market-warmup of 3
  // months for new pipeline.
  return totalNew / 2 / monthlyAbs + 3;
}

function solveForP(p: number, k: number, t0: number): number {
  // Inverse of logistic: t = t0 + (1/k) * ln(p / (1-p))
  return t0 + (1 / k) * Math.log(p / (1 - p));
}
