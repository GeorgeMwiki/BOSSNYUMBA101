/**
 * classifyAction — the public entry-point for auto-mode safety
 * classification.
 *
 * Pipeline:
 *
 *   1. Cache lookup by `(tenant, tool, normalised-args)`.
 *   2. Cache miss -> delegate to `ClassifierPort` (Haiku-class LLM).
 *   3. Cache the verdict for `cacheTtlMs` (default 1h).
 *   4. Return the verdict.
 *
 * Read-only and dryRun tool calls SHORT-CIRCUIT to `safe` without
 * touching the LLM — these are the auto-mode "auto-allow" cases per
 * the Claude Code spec.
 */

import type { RiskTier } from '../types.js';
import type {
  ClassifierInput,
  ClassifierPort,
  ClassifierVerdict,
  VerdictCachePort,
} from './types.js';
import { deriveCacheKey } from './cache-key.js';

/**
 * Auto-allow rules — tiers + tool patterns the kernel should NEVER
 * pay classifier latency for. Mirrors Claude Code's "read-only +
 * cwd-edits skip classifier" behaviour.
 */
const ALWAYS_SAFE_TIERS: ReadonlySet<RiskTier> = new Set<RiskTier>(['read']);

export interface ClassifyActionDeps {
  readonly port: ClassifierPort;
  readonly cache: VerdictCachePort;
  /** Per-key cache TTL. Default 3_600_000 ms (1h). */
  readonly cacheTtlMs?: number;
  /**
   * Optional hook for the kernel — fires every time the LLM is
   * invoked (cache miss). Use for cost telemetry.
   */
  readonly onMiss?: (input: ClassifierInput) => void;
  /**
   * Optional hook for cache hits. Use for telemetry.
   */
  readonly onHit?: (input: ClassifierInput, cached: ClassifierVerdict) => void;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000;

const SAFE_SHORT_CIRCUIT: ClassifierVerdict = Object.freeze({
  verdict: 'safe',
  reason: 'read-tier tool — auto-allowed by policy',
  recommendPlanMode: false,
});

export async function classifyAction(
  input: ClassifierInput,
  deps: ClassifyActionDeps,
): Promise<ClassifierVerdict> {
  // Auto-allow short-circuit: never spend classifier latency on reads.
  if (ALWAYS_SAFE_TIERS.has(input.tier)) {
    return SAFE_SHORT_CIRCUIT;
  }

  const key = deriveCacheKey(input);
  const cached = deps.cache.get(key);
  if (cached) {
    deps.onHit?.(input, cached);
    return cached;
  }

  deps.onMiss?.(input);
  const verdict = await deps.port.classify(input);

  // Sanity guard: never cache an unsafe verdict — the conversation
  // context may have shifted; we'd rather reclassify on the next turn.
  if (verdict.verdict !== 'unsafe') {
    deps.cache.set(key, verdict, deps.cacheTtlMs ?? DEFAULT_TTL_MS);
  }
  return verdict;
}

/**
 * Translate a verdict to the action the kernel should take.
 *
 *   safe       -> auto-execute (caller proceeds with the tool call).
 *   borderline -> ask the owner (caller emits AskUserQuestion).
 *   unsafe     -> deny + escalate (caller surfaces an explanation +
 *                 asks the owner explicitly).
 *
 * Kept as a pure helper so the kernel doesn't sprinkle string
 * comparisons through its dispatch.
 */
export type AutoModeAction = 'auto-execute' | 'ask-owner' | 'deny-and-escalate';

export function verdictToAction(verdict: ClassifierVerdict): AutoModeAction {
  switch (verdict.verdict) {
    case 'safe':
      return 'auto-execute';
    case 'borderline':
      return 'ask-owner';
    case 'unsafe':
      return 'deny-and-escalate';
  }
}
