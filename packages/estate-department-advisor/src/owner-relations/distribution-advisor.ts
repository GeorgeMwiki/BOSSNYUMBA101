/**
 * distribution-advisor — frequency + smoothing policy.
 *
 * Per NAREIT REIT distribution practice + PERE private-fund study.
 *
 * Smoothing rule: distribution targets P50 of trailing 4 quarters.
 * Reserve cap: 6 months opex + scheduled capex before distribution.
 */

import type { OwnerArchetype } from '../types.js';

export interface DistributionInput {
  readonly archetype: OwnerArchetype;
  readonly trailingQuarterNoiUsd: ReadonlyArray<number>; // length 4
  readonly cashReserveUsd: number;
  readonly monthlyOpexUsd: number;
  readonly scheduledCapexUsd: number;
  readonly currentEquityUsd: number;
  readonly debtServiceQuarterlyUsd: number;
}

export interface DistributionAdvice {
  readonly recommendedQuarterlyUsd: number;
  readonly canDistribute: boolean;
  readonly reasoning: string;
  readonly citation: string;
}

function median(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const left = sorted[mid - 1];
  const right = sorted[mid];
  if (sorted.length % 2 === 0 && left !== undefined && right !== undefined) {
    return (left + right) / 2;
  }
  return sorted[mid] ?? 0;
}

export function adviseDistribution(input: DistributionInput): DistributionAdvice {
  const reserveFloor = input.monthlyOpexUsd * 6 + input.scheduledCapexUsd;
  if (input.cashReserveUsd < reserveFloor) {
    return {
      recommendedQuarterlyUsd: 0,
      canDistribute: false,
      reasoning: `Reserve $${Math.round(input.cashReserveUsd).toLocaleString('en-US')} below floor $${Math.round(reserveFloor).toLocaleString('en-US')} (6 mo opex + scheduled capex) — distribution suspended per NAREIT discipline.`,
      citation: 'NAREIT distribution policy + PERE 2024 private-fund standards',
    };
  }
  const distributable = Math.max(0, median(input.trailingQuarterNoiUsd) - input.debtServiceQuarterlyUsd);

  // Archetype-aware payout ratio.
  let payoutRatio: number;
  switch (input.archetype) {
    case 'cashflow-first':
      payoutRatio = 0.95;
      break;
    case 'preservation-legacy':
      payoutRatio = 0.55;
      break;
    case 'growth-acquisitive':
      payoutRatio = 0.30;
      break;
    case 'institutional':
      payoutRatio = 0.80;
      break;
    case 'exit-prep':
      payoutRatio = 0.65;
      break;
    case 'passive-landlord':
      payoutRatio = 0.90;
      break;
    case 'active-investor':
      payoutRatio = 0.50;
      break;
    case 'distressed-forced-sale':
      payoutRatio = 0.10;
      break;
    default:
      payoutRatio = 0.70;
  }

  return {
    recommendedQuarterlyUsd: Math.round(distributable * payoutRatio),
    canDistribute: true,
    reasoning: `Trailing-4Q NOI median = $${Math.round(median(input.trailingQuarterNoiUsd)).toLocaleString('en-US')}; archetype payout ratio ${(payoutRatio * 100).toFixed(0)}% after debt service.`,
    citation: 'NAREIT distribution policy + PERE 2024',
  };
}

export const __test__ = { median };
