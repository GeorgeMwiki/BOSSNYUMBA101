import { describe, expect, it } from 'vitest';
import {
  BATCH_MULTIPLIER,
  CACHED_INPUT_MULTIPLIER,
  CACHE_WRITE_1H_SURCHARGE,
  CACHE_WRITE_5MIN_SURCHARGE,
  ON_DEMAND_PRICING,
  calculateStackedCost,
} from './cost-stacking.js';

describe('calculateStackedCost', () => {
  it('applies on-demand rates when batched=false and no cache used', () => {
    const r = calculateStackedCost({
      model: 'claude-sonnet-4-6',
      batched: false,
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    // 3.00 input + 15.00 output = 18.00
    expect(r.totalCostUsd).toBeCloseTo(18.0, 4);
    expect(r.effectiveDiscount).toBeCloseTo(0, 4);
  });

  it('applies 50% off when batched=true', () => {
    const onDemand = calculateStackedCost({
      model: 'claude-sonnet-4-6',
      batched: false,
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    const batched = calculateStackedCost({
      model: 'claude-sonnet-4-6',
      batched: true,
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(batched.totalCostUsd / onDemand.totalCostUsd).toBeCloseTo(0.5, 3);
    expect(batched.effectiveDiscount).toBeCloseTo(0.5, 3);
  });

  it('stacks batch (50%) + cached input (90% off cached) for ~95% off on cache-heavy', () => {
    // All input is cached read, output minimal — pure cache replay scenario
    const r = calculateStackedCost({
      model: 'claude-sonnet-4-6',
      batched: true,
      inputTokens: 0,
      outputTokens: 1_000,
      cachedInputTokens: 1_000_000,
      cacheTtlSeconds: 3600,
    });
    // Expect ~95% off baseline (some output cost remains)
    expect(r.effectiveDiscount).toBeGreaterThan(0.94);
  });

  it('charges 1h cache write surcharge', () => {
    const r5min = calculateStackedCost({
      model: 'claude-opus-4-7',
      batched: false,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 1_000_000,
      cacheTtlSeconds: 300,
    });
    const r1h = calculateStackedCost({
      model: 'claude-opus-4-7',
      batched: false,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 1_000_000,
      cacheTtlSeconds: 3600,
    });
    expect(r1h.cacheCreationCostUsd / r5min.cacheCreationCostUsd).toBeCloseTo(
      CACHE_WRITE_1H_SURCHARGE / CACHE_WRITE_5MIN_SURCHARGE,
      3,
    );
  });

  it('exposes constants matching the L2 audit table', () => {
    expect(BATCH_MULTIPLIER).toBe(0.5);
    expect(CACHED_INPUT_MULTIPLIER).toBe(0.1);
    expect(CACHE_WRITE_1H_SURCHARGE).toBe(1.25);
    expect(CACHE_WRITE_5MIN_SURCHARGE).toBe(1.0);
  });

  it('exposes pricing for opus / sonnet / haiku per the L2 table', () => {
    expect(ON_DEMAND_PRICING['claude-opus-4-7'].inputPerMTok).toBe(5.0);
    expect(ON_DEMAND_PRICING['claude-sonnet-4-6'].inputPerMTok).toBe(3.0);
    expect(ON_DEMAND_PRICING['claude-haiku-4-5'].inputPerMTok).toBe(1.0);
    expect(ON_DEMAND_PRICING['claude-opus-4-7'].outputPerMTok).toBe(25.0);
    expect(ON_DEMAND_PRICING['claude-sonnet-4-6'].outputPerMTok).toBe(15.0);
    expect(ON_DEMAND_PRICING['claude-haiku-4-5'].outputPerMTok).toBe(5.0);
  });

  it('reports baseline cost matching on-demand', () => {
    const r = calculateStackedCost({
      model: 'claude-haiku-4-5',
      batched: true,
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(r.onDemandBaselineUsd).toBeCloseTo(1.0, 4);
  });

  it('handles zero-input zero-output cleanly', () => {
    const r = calculateStackedCost({
      model: 'claude-sonnet-4-6',
      batched: true,
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(r.totalCostUsd).toBe(0);
    expect(r.effectiveDiscount).toBe(0);
  });
});
