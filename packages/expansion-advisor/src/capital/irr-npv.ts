/**
 * IRR / NPV — pure-function implementations.
 *
 * IRR uses Newton–Raphson with a robust bisection fallback so it
 * still converges on cash-flow series whose derivative is small
 * near the root (long-tail real-estate cash-flows).
 */

import type { IrrNpvInputs, IrrNpvResult } from '../types.js';

export function npv(rate: number, cashflows: ReadonlyArray<number>): number {
  return cashflows.reduce(
    (acc, cf, idx) => acc + cf / Math.pow(1 + rate, idx),
    0,
  );
}

function npvDerivative(rate: number, cashflows: ReadonlyArray<number>): number {
  return cashflows.reduce((acc, cf, idx) => {
    if (idx === 0) return acc;
    return acc + (-idx * cf) / Math.pow(1 + rate, idx + 1);
  }, 0);
}

/**
 * IRR via Newton–Raphson with bisection fallback.
 *
 * Returns `NaN` only when the series has no sign change (i.e. no
 * IRR exists). Otherwise returns a stable root in [-0.99, 10].
 */
export function irr(cashflows: ReadonlyArray<number>): number {
  if (cashflows.length < 2) return NaN;
  const hasPos = cashflows.some((c) => c > 0);
  const hasNeg = cashflows.some((c) => c < 0);
  if (!hasPos || !hasNeg) return NaN;

  // Newton–Raphson
  let rate = 0.1;
  for (let i = 0; i < 50; i += 1) {
    const f = npv(rate, cashflows);
    const fp = npvDerivative(rate, cashflows);
    if (!Number.isFinite(fp) || Math.abs(fp) < 1e-12) break;
    const next = rate - f / fp;
    if (!Number.isFinite(next)) break;
    if (Math.abs(next - rate) < 1e-7) return clampRate(next);
    rate = clampRate(next);
  }

  // Bisection fallback in [-0.99, 10]
  let lo = -0.99;
  let hi = 10;
  let fLo = npv(lo, cashflows);
  let fHi = npv(hi, cashflows);
  if (fLo * fHi > 0) return NaN;
  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, cashflows);
    if (Math.abs(fMid) < 1e-7) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

function clampRate(rate: number): number {
  if (rate < -0.99) return -0.99;
  if (rate > 10) return 10;
  return rate;
}

export function irrNpv(input: IrrNpvInputs): IrrNpvResult {
  return {
    npv: npv(input.discountRatePerPeriod, input.cashflows),
    irr: irr(input.cashflows),
  };
}
