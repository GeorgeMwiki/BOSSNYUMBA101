/**
 * Cap-rate derivative from a comp set — institutional pattern.
 *
 * Drops top + bottom 10 % of comp cap rates (trim) and returns
 * trimmed-mean + median + sample sigma. Computes spread (bps) to
 * the supplied risk-free rate (10-yr KE / TZ / UG gov bond or US
 * 10-yr Treasury) for cap-rate-spread compression monitoring.
 */

import type { CapRateDerivative, ComparableSale } from '../types.js';

export interface CapRateDerivativeInputs {
  readonly comps: ReadonlyArray<ComparableSale>;
  readonly riskFreeRate: number; // decimal (e.g. 0.045 for 4.5%)
  /** Trim share each tail; default 0.10. */
  readonly trimShare?: number;
}

export function computeCapRateDerivative(
  inputs: CapRateDerivativeInputs,
): CapRateDerivative {
  const trim = inputs.trimShare ?? 0.10;
  if (trim < 0 || trim >= 0.5) {
    throw new Error('trimShare must be in [0, 0.5)');
  }
  if (inputs.comps.length === 0) {
    return {
      trimmedMean: 0,
      median: 0,
      sigma: 0,
      spreadBps: 0,
      compCount: 0,
    };
  }
  const sorted = inputs.comps.map((c) => c.capRate).slice().sort((a, b) => a - b);

  const dropEach = Math.floor(sorted.length * trim);
  const trimmed = sorted.slice(dropEach, sorted.length - dropEach);

  const trimmedMean =
    trimmed.length > 0
      ? trimmed.reduce((a, b) => a + b, 0) / trimmed.length
      : sorted.reduce((a, b) => a + b, 0) / sorted.length;

  const median = medianOf(sorted);
  const sigma = stdDev(sorted, trimmedMean);
  const spreadBps = Math.round((trimmedMean - inputs.riskFreeRate) * 10_000);

  return {
    trimmedMean,
    median,
    sigma,
    spreadBps,
    compCount: inputs.comps.length,
  };
}

function medianOf(sorted: ReadonlyArray<number>): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stdDev(values: ReadonlyArray<number>, mean: number): number {
  if (values.length === 0) return 0;
  const variance =
    values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
