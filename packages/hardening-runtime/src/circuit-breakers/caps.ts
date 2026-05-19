/**
 * Default circuit-breaker caps for an agent loop.
 *
 * L3 §8 #3 (score 20) — "One looping agent = $500." We already have K-B
 * safe-mode; pair it with hard caps so a runaway loop is impossible.
 *
 * Defaults:
 *   30 steps · $5 cost · 120s wall · 100 tool calls
 *
 * Per-tenant caps overridable via K-F budget integration.
 */

import type { CircuitBreakerCaps } from '../types.js';

/**
 * Frozen platform-default caps. NEVER mutated — callers override by
 * spreading into a new object via `mergeCaps`.
 */
export const DEFAULT_CIRCUIT_BREAKER_CAPS: CircuitBreakerCaps = Object.freeze({
  maxSteps: 30,
  maxCostUsdCents: 500, // $5.00
  maxWallTimeMs: 120_000,
  maxToolCalls: 100,
});

/**
 * Merge a partial-override into the defaults. Every undefined field
 * falls back to the platform default. Returns a frozen object.
 */
export function mergeCaps(
  override?: Partial<CircuitBreakerCaps>,
): CircuitBreakerCaps {
  if (!override) return DEFAULT_CIRCUIT_BREAKER_CAPS;
  const merged: CircuitBreakerCaps = {
    maxSteps: override.maxSteps ?? DEFAULT_CIRCUIT_BREAKER_CAPS.maxSteps,
    maxCostUsdCents:
      override.maxCostUsdCents ?? DEFAULT_CIRCUIT_BREAKER_CAPS.maxCostUsdCents,
    maxWallTimeMs:
      override.maxWallTimeMs ?? DEFAULT_CIRCUIT_BREAKER_CAPS.maxWallTimeMs,
    maxToolCalls:
      override.maxToolCalls ?? DEFAULT_CIRCUIT_BREAKER_CAPS.maxToolCalls,
  };
  return Object.freeze(merged);
}
