/**
 * Distribution forecaster — projects LP / GP distributions through a
 * 4-tier waterfall (return-of-capital → pref → catch-up → split).
 *
 * Authority: PERE Waterfall Survey 2024, NAIOP Real Estate Capital
 * Markets Survey 2024.
 *
 * Supports American-style waterfall on a single-cohort cash-flow
 * series; per-period accrual of compounded preferred return.
 */

import type {
  DistributionForecastInputs,
  DistributionForecastResult,
  WaterfallTier,
} from '../types.js';

// IRR computation reused from a small inline solver (no external dep).
function npv(rate: number, cf: ReadonlyArray<number>): number {
  return cf.reduce((acc, v, i) => acc + v / Math.pow(1 + rate, i), 0);
}

function irr(cf: ReadonlyArray<number>): number {
  if (cf.length < 2) return NaN;
  const hasPos = cf.some((c) => c > 0);
  const hasNeg = cf.some((c) => c < 0);
  if (!hasPos || !hasNeg) return NaN;
  let lo = -0.99;
  let hi = 10;
  let fLo = npv(lo, cf);
  let fHi = npv(hi, cf);
  if (fLo * fHi > 0) return NaN;
  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, cf);
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

export function forecastDistributions(
  inputs: Readonly<DistributionForecastInputs>,
): DistributionForecastResult {
  if (inputs.lpCommitment <= 0) {
    throw new Error('forecastDistributions: lpCommitment must be > 0');
  }
  const perPeriod: Array<{
    period: number;
    lpDist: number;
    gpDist: number;
    cumulativeLP: number;
    cumulativeGP: number;
  }> = [];

  let lpCapitalReturned = 0;
  let lpAccruedPref = 0;
  let gpPromoteEarned = 0;
  let cumulativeLP = 0;
  let cumulativeGP = 0;

  // Cash flow series for IRR — start with -commitment at t=0
  const lpCashflow: number[] = [-inputs.lpCommitment];
  const gpCashflow: number[] = [0]; // GP doesn't contribute (single-LP model)

  const sortedTiers: ReadonlyArray<WaterfallTier> = inputs.tiers;

  for (let t = 0; t < inputs.periodCashflows.length; t += 1) {
    let available = inputs.periodCashflows[t]!;
    let lpDist = 0;
    let gpDist = 0;

    // Accrue compounded preferred return for the period on outstanding LP capital
    const lpOutstanding = inputs.lpCommitment - lpCapitalReturned;
    lpAccruedPref += lpOutstanding * inputs.prefRate;

    for (const tier of sortedTiers) {
      if (available <= 0) break;
      if (tier.type === 'return-of-capital') {
        const need = inputs.lpCommitment - lpCapitalReturned;
        const pay = Math.min(available, need);
        lpDist += pay;
        lpCapitalReturned += pay;
        available -= pay;
      } else if (tier.type === 'pref') {
        const pay = Math.min(available, lpAccruedPref);
        lpDist += pay;
        lpAccruedPref -= pay;
        available -= pay;
      } else if (tier.type === 'catch-up') {
        // GP receives 100 % until total split ratio reaches catchUpToPct
        const target = tier.catchUpToPct ?? 0.20;
        // GP catch-up amount so that gp/(lpAfterRoC + gp) = target
        const lpReceived = lpDist + cumulativeLP;
        const gpReceived = gpDist + cumulativeGP;
        const totalSplitBasis = lpReceived; // pref + RoC paid → catch-up runs on the same basis
        const targetGP = (totalSplitBasis * target) / (1 - target) - gpReceived;
        const pay = Math.max(0, Math.min(available, targetGP));
        gpDist += pay;
        gpPromoteEarned += pay;
        available -= pay;
      } else if (tier.type === 'split') {
        const lpShare = tier.lpShare ?? 0.80;
        const gpShare = tier.gpShare ?? 0.20;
        // Optionally gated by hurdle
        if (tier.hurdleIRR !== undefined) {
          // Compute current LP-only IRR including a hypothetical pay-out
          const hypoLP = [...lpCashflow, lpDist + available * lpShare];
          const curIRR = irr(hypoLP);
          if (!Number.isFinite(curIRR) || curIRR < tier.hurdleIRR) {
            // Below hurdle, give all to LP
            lpDist += available;
            available = 0;
            continue;
          }
        }
        lpDist += available * lpShare;
        gpDist += available * gpShare;
        gpPromoteEarned += available * gpShare;
        available = 0;
      }
    }

    cumulativeLP += lpDist;
    cumulativeGP += gpDist;
    lpCashflow.push(lpDist);
    gpCashflow.push(gpDist);
    perPeriod.push({
      period: t,
      lpDist,
      gpDist,
      cumulativeLP,
      cumulativeGP,
    });
  }

  const lpIRR = irr(lpCashflow);
  const gpIRR = gpCashflow.some((c) => c < 0) ? irr(gpCashflow) : NaN;
  const lpMOIC = cumulativeLP / inputs.lpCommitment;
  const gpMOIC = gpPromoteEarned > 0 ? cumulativeGP / Math.max(1, gpPromoteEarned) : 0;

  return {
    perPeriod,
    lpIRR,
    gpIRR,
    lpMOIC,
    gpMOIC,
  };
}
