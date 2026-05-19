/**
 * PI-A · confidence · computeConfidence — fuses all five factors into a
 * single ConfidenceTier and ConfidenceScore.
 *
 * Algorithm:
 *   start = baseRate(source.kind)
 *   start *= explicitConfidence(source.confidence)
 *   start += corroborationBonus(history, observation) — capped at 0.15
 *   start -= conflictPenalty(currentValue, observedValue) — up to 0.4
 *   start -= jurisdictionPenalty(violations) — hard cap to LOW if violated
 *   clamp to [0, 1]
 *   tier = score ≥ 0.9 → high · 0.7..<0.9 → medium · else low
 *
 * The function is pure — no I/O. The caller (autoFill module) feeds the
 * history and current value.
 */

import type { ObservationEvent } from '../observations/types.js';

import {
  HIGH_THRESHOLD,
  MEDIUM_THRESHOLD,
  SOURCE_BASE_RATES,
  type ConfidenceBreakdown,
  type ConfidenceScore,
  type ConfidenceTier,
  type HistoricalObservation,
} from './types.js';

export interface ComputeConfidenceInput {
  readonly observation: ObservationEvent;
  readonly currentValue: unknown;
  readonly history: ReadonlyArray<HistoricalObservation>;
  /** True iff the observed value violates a JurisdictionalRule. */
  readonly jurisdictionViolation?: boolean;
}

function tierOf(score: number): ConfidenceTier {
  if (score >= HIGH_THRESHOLD) return 'high';
  if (score >= MEDIUM_THRESHOLD) return 'medium';
  return 'low';
}

/**
 * Cross-source corroboration. Each *independent* source kind that has
 * recorded the same observedValue contributes +0.05 (max +0.15).
 *
 * The current observation's own source-ref is counted as one corroboration;
 * historical entries with the same source-ref are not double-counted.
 */
function corroborationBonus(input: ComputeConfidenceInput): number {
  const independent = new Set<string>([input.observation.source.kind]);
  for (const h of input.history) {
    if (deepEqual(h.observedValue, input.observation.observedValue)) {
      independent.add(h.source.kind);
    }
  }
  // -1 because the current observation is the baseline (already counted in baseRate)
  const otherSources = Math.max(0, independent.size - 1);
  return Math.min(0.15, otherSources * 0.05);
}

/**
 * Conflict penalty. Overwriting a non-empty existing value with a *different*
 * value drops confidence by 0.4; idempotent re-confirms incur no penalty;
 * filling in a previously-empty value also incurs no penalty.
 */
function conflictPenalty(observation: ObservationEvent, currentValue: unknown): number {
  if (currentValue === undefined || currentValue === null || currentValue === '') return 0;
  return deepEqual(currentValue, observation.observedValue) ? 0 : 0.4;
}

/** Deep-equal for the kinds of values attributes carry (primitives, ISO dates, simple records). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ak = Object.keys(a as Record<string, unknown>).sort();
  const bk = Object.keys(b as Record<string, unknown>).sort();
  if (ak.length !== bk.length || ak.some((k, i) => k !== bk[i])) return false;
  return ak.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/**
 * Compute the ConfidenceScore for an observation.
 *
 * Hard-cap: if `jurisdictionViolation` is true, the tier is forced to 'low'
 * regardless of any other factor — the platform must not auto-apply a value
 * that violates a JurisdictionalRule (M-F / M-B's destructive-change gate).
 */
export function computeConfidence(input: ComputeConfidenceInput): ConfidenceScore {
  const baseRate = SOURCE_BASE_RATES[input.observation.source.kind];
  const explicitConfidence = input.observation.source.confidence;
  const corroboration = corroborationBonus(input);
  const conflict = conflictPenalty(input.observation, input.currentValue);
  const jurisdictionPenalty = input.jurisdictionViolation ? 1 : 0;
  let score = baseRate * explicitConfidence + corroboration - conflict;
  if (jurisdictionPenalty > 0) score = Math.min(score, MEDIUM_THRESHOLD - 0.001);
  score = Math.max(0, Math.min(1, score));
  const breakdown: ConfidenceBreakdown = {
    baseRate,
    corroborationBonus: corroboration,
    conflictPenalty: conflict,
    explicitConfidence,
    jurisdictionPenalty,
  };
  return Object.freeze({ score, tier: tierOf(score), breakdown });
}
