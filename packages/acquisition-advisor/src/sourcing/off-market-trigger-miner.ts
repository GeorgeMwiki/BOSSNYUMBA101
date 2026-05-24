/**
 * Off-market trigger miner — scores raw owner-event signals into
 * a priority queue for outreach.
 *
 * Per PERE Off-Market Origination Study 2024 + REBNY Distressed
 * Asset Brief 2024 Q4. Six trigger families; each carries a
 * conversion prior. Expected-value = ev × evidence-confidence.
 */

import type {
  OffMarketTriggerSignal,
  OffMarketTriggerScored,
  OffMarketTriggerType,
} from '../types.js';

const BASE_CONVERSION_PRIORS: Readonly<Record<OffMarketTriggerType, number>> = {
  probate: 0.18,
  foreclosure: 0.31,
  taxLien: 0.12,
  codeViolation: 0.08,
  loanMaturity: 0.22,
  divorce: 0.06,
};

export function scoreOffMarketTrigger(
  signal: Readonly<OffMarketTriggerSignal>,
): OffMarketTriggerScored {
  if (signal.evidenceConfidence < 0 || signal.evidenceConfidence > 1) {
    throw new Error(`evidenceConfidence must be in [0,1]`);
  }
  if (signal.conversionPriorPct < 0 || signal.conversionPriorPct > 1) {
    throw new Error(`conversionPriorPct must be in [0,1]`);
  }
  const conversionFloor = BASE_CONVERSION_PRIORS[signal.type] ?? 0.05;
  const conversionUsed = Math.max(conversionFloor, signal.conversionPriorPct);
  const expectedValue = conversionUsed * signal.evidenceConfidence;

  const priorityBand: OffMarketTriggerScored['priorityBand'] =
    expectedValue >= 0.20
      ? 'hot'
      : expectedValue >= 0.10
        ? 'warm'
        : 'cold';

  return {
    ...signal,
    expectedValue,
    priorityBand,
  };
}

export function rankTriggers(
  signals: ReadonlyArray<OffMarketTriggerSignal>,
): ReadonlyArray<OffMarketTriggerScored> {
  return signals
    .map(scoreOffMarketTrigger)
    .slice()
    .sort((a, b) => b.expectedValue - a.expectedValue);
}

export const OFF_MARKET_CONVERSION_PRIORS = BASE_CONVERSION_PRIORS;
