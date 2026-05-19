/**
 * Cost stacking arithmetic — Batch × Cache.
 *
 * Per L2 audit §6.3:
 *   "batch (50%) × prompt-cache (90% off cached input) × long-context
 *    (no surcharge under 200k) = 95% off baseline."
 *
 * Anthropic applies the batch multiplier first, then caching multipliers.
 */

import type { ClaudeModelId } from '../types.js';

export interface ModelOnDemandPricing {
  readonly inputPerMTok: number;
  readonly outputPerMTok: number;
}

export const ON_DEMAND_PRICING: Readonly<
  Record<ClaudeModelId, ModelOnDemandPricing>
> = {
  'claude-opus-4-7': { inputPerMTok: 5.0, outputPerMTok: 25.0 },
  'claude-opus-4-6': { inputPerMTok: 5.0, outputPerMTok: 25.0 },
  'claude-opus-4-5': { inputPerMTok: 5.0, outputPerMTok: 25.0 },
  'claude-sonnet-4-6': { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  'claude-sonnet-4-5': { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  'claude-haiku-4-5': { inputPerMTok: 1.0, outputPerMTok: 5.0 },
};

/** Batch multiplier — 50% off baseline. */
export const BATCH_MULTIPLIER = 0.5;

/** Cached input multiplier — 10% of base (90% off). */
export const CACHED_INPUT_MULTIPLIER = 0.1;

/** Cache write (1h ttl) — 25% surcharge over baseline; 5min ttl has no surcharge. */
export const CACHE_WRITE_1H_SURCHARGE = 1.25;
export const CACHE_WRITE_5MIN_SURCHARGE = 1.0;

export interface StackedCostInput {
  readonly model: ClaudeModelId;
  readonly batched: boolean;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens?: number;
  readonly cacheCreationTokens?: number;
  readonly cacheTtlSeconds?: 300 | 3600;
}

export interface StackedCostBreakdown {
  readonly inputCostUsd: number;
  readonly outputCostUsd: number;
  readonly cachedInputCostUsd: number;
  readonly cacheCreationCostUsd: number;
  readonly totalCostUsd: number;
  readonly onDemandBaselineUsd: number;
  readonly effectiveDiscount: number;
}

export function calculateStackedCost(
  input: StackedCostInput,
): StackedCostBreakdown {
  const pricing = ON_DEMAND_PRICING[input.model];
  const batchMul = input.batched ? BATCH_MULTIPLIER : 1.0;

  const baseInputRate = pricing.inputPerMTok * batchMul;
  const baseOutputRate = pricing.outputPerMTok * batchMul;

  const inputCostUsd = (input.inputTokens * baseInputRate) / 1_000_000;
  const outputCostUsd = (input.outputTokens * baseOutputRate) / 1_000_000;

  const cachedInputTokens = input.cachedInputTokens ?? 0;
  const cachedInputCostUsd =
    (cachedInputTokens * baseInputRate * CACHED_INPUT_MULTIPLIER) / 1_000_000;

  const cacheWriteSurcharge =
    input.cacheTtlSeconds === 3600
      ? CACHE_WRITE_1H_SURCHARGE
      : CACHE_WRITE_5MIN_SURCHARGE;
  const cacheCreationTokens = input.cacheCreationTokens ?? 0;
  const cacheCreationCostUsd =
    (cacheCreationTokens * baseInputRate * cacheWriteSurcharge) / 1_000_000;

  const totalCostUsd =
    inputCostUsd + outputCostUsd + cachedInputCostUsd + cacheCreationCostUsd;

  // Baseline: on-demand, no cache
  const totalAllInput = input.inputTokens + cachedInputTokens + cacheCreationTokens;
  const onDemandBaselineUsd =
    (totalAllInput * pricing.inputPerMTok +
      input.outputTokens * pricing.outputPerMTok) /
    1_000_000;

  const effectiveDiscount =
    onDemandBaselineUsd > 0
      ? 1 - totalCostUsd / onDemandBaselineUsd
      : 0;

  return {
    inputCostUsd,
    outputCostUsd,
    cachedInputCostUsd,
    cacheCreationCostUsd,
    totalCostUsd,
    onDemandBaselineUsd,
    effectiveDiscount,
  };
}
