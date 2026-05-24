/**
 * Rate-lock timing — decide lock-now vs wait based on forward
 * Treasury curve and implied volatility.
 *
 * Authority: Bloomberg US Treasury Forward Curves 2026 Q1, BondPro
 * Lock-Fee Survey 2024.
 */

import type { RateLockInputs, RateLockResult } from '../types.js';

const VOL_HIGH_BPS = 80;
const RATE_DELTA_BPS_FOR_WAIT = 15;

export function adviseRateLock(
  inputs: Readonly<RateLockInputs>,
): RateLockResult {
  const forwardPremiumBps = (inputs.forward10Y6mo - inputs.spot10Y) * 10_000;

  if (inputs.impliedVolBps > VOL_HIGH_BPS) {
    return {
      advice: 'lock-now-vol',
      forwardPremiumBps,
      rationale: `1-month implied vol ${inputs.impliedVolBps.toFixed(0)} bps > ${VOL_HIGH_BPS} bps — lock now as insurance regardless of forward`,
    };
  }
  // If forward is meaningfully lower (>15 bps), wait
  if (forwardPremiumBps < -RATE_DELTA_BPS_FOR_WAIT) {
    return {
      advice: 'wait',
      forwardPremiumBps,
      rationale: `forward curve shows ${(-forwardPremiumBps).toFixed(0)} bps decline — wait, lock later`,
    };
  }
  // If lock-fee cheaper than spot-to-forward premium, lock now to save fee
  // Convert lock fee (decimal of loan) to bps approximation
  const lockFeeBps = inputs.lockFee6mo * 10_000;
  if (lockFeeBps < Math.abs(forwardPremiumBps)) {
    return {
      advice: 'lock-now',
      forwardPremiumBps,
      rationale: `lock-fee ${lockFeeBps.toFixed(0)} bps < forward-premium ${Math.abs(forwardPremiumBps).toFixed(0)} bps — lock now, save fee`,
    };
  }
  return {
    advice: 'lock-now',
    forwardPremiumBps,
    rationale: `forward / vol benign — lock now per default conservative posture`,
  };
}
