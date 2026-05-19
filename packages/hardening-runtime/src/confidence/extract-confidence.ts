/**
 * extractConfidence — derive `Confidence` from an LLM response.
 *
 * L3 §1 #1 — verbalized + logprob → autonomy-slider live drive. The K-E
 * autonomy slider consumes `mode`:
 *
 *   calibrated < 0.30  →  safe-mode (K-B fallback engages)
 *   calibrated < 0.50  →  plan-mode (no execute; surface draft)
 *   calibrated < 0.70  →  high-confidence-only (low-stakes only)
 *   calibrated >= 0.70 →  normal autonomy
 *   calibrated >= 0.95 →  destructive-eligible (still gated by L3 #5)
 *
 * Pure function. No side-effects. Frozen output.
 */

import type { Confidence, ConfidenceMode, LlmResponse } from '../types.js';
import { combineCalibrated } from './calibrate.js';

/**
 * Just-Ask-Confidence regex — looks for verbalized self-rating in the
 * response. Matches:
 *   "confidence: 0.82"
 *   "confidence: 8/10"
 *   "I am 75% confident"
 *   "I am 7/10 confident"
 *   "confidence score: 0.91"
 *
 * Captured value is normalised to [0, 1].
 */
const VERBALIZED_PATTERNS: ReadonlyArray<{
  readonly regex: RegExp;
  readonly normalise: (m: RegExpMatchArray) => number;
}> = Object.freeze([
  {
    regex: /confidence\s*(?:score)?\s*[:=]\s*(\d+(?:\.\d+)?)\s*\/\s*10/i,
    normalise: (m) => Number(m[1]) / 10,
  },
  {
    regex: /confidence\s*(?:score)?\s*[:=]\s*(\d+(?:\.\d+)?)\s*%/i,
    normalise: (m) => Number(m[1]) / 100,
  },
  {
    regex: /confidence\s*(?:score)?\s*[:=]\s*(\d+(?:\.\d+)?)/i,
    normalise: (m) => {
      const v = Number(m[1]);
      if (v > 1 && v <= 10) return v / 10;
      if (v > 10 && v <= 100) return v / 100;
      return v;
    },
  },
  {
    regex:
      /I[' ]?(?:a)?m\s+(\d+(?:\.\d+)?)\s*%\s+confident/i,
    normalise: (m) => Number(m[1]) / 100,
  },
  {
    regex:
      /I[' ]?(?:a)?m\s+(\d+(?:\.\d+)?)\s*\/\s*10\s+confident/i,
    normalise: (m) => Number(m[1]) / 10,
  },
]);

/**
 * Extract `Confidence` from an LLM response.
 *
 * Inputs:
 *   - `response.text` — scanned for verbalized confidence patterns
 *   - `response.logprob` — when present, exponentiated and clamped to [0,1]
 *
 * Returns a frozen `Confidence` with the routing `mode` already resolved.
 */
export function extractConfidence(response: LlmResponse): Confidence {
  const verbalized = extractVerbalized(response.text);
  const logprob = normaliseLogprob(response.logprob);
  const calibrated = combineCalibrated(verbalized, logprob);
  const mode = routeMode(calibrated);
  const reason = explainRouting(verbalized, logprob, calibrated, mode);
  return Object.freeze({
    verbalized,
    logprob,
    calibrated,
    mode,
    reason,
  });
}

function extractVerbalized(text: string): number | null {
  if (!text) return null;
  for (const { regex, normalise } of VERBALIZED_PATTERNS) {
    const m = text.match(regex);
    if (m) {
      const v = normalise(m);
      if (Number.isFinite(v) && v >= 0 && v <= 1) return v;
    }
  }
  return null;
}

/**
 * Normalise a raw logprob into a [0,1] probability.
 *
 * The L3 contract: API returns `logprob` already exponentiated to a 0..1
 * probability. If it's a negative number (raw log-probability), we
 * exp() it. If null or NaN, return null.
 */
function normaliseLogprob(logprob: number | null): number | null {
  if (logprob === null) return null;
  if (!Number.isFinite(logprob)) return null;
  // If the caller passes a raw negative log-probability (e.g. -1.5), we
  // exp it. Anthropic + OpenAI both expose sum-of-token-logprobs.
  if (logprob < 0) {
    const p = Math.exp(logprob);
    return clamp01(p);
  }
  return clamp01(logprob);
}

/**
 * Route the calibrated score to a `ConfidenceMode`.
 *
 * Thresholds verbatim from L3 §1 #1 + §4.4 selective prediction.
 */
function routeMode(calibrated: number): ConfidenceMode {
  if (calibrated < 0.3) return 'safe-mode';
  if (calibrated < 0.5) return 'plan-mode';
  if (calibrated < 0.7) return 'high-confidence-only';
  if (calibrated < 0.95) return 'normal';
  return 'destructive-eligible';
}

function explainRouting(
  v: number | null,
  l: number | null,
  c: number,
  m: ConfidenceMode,
): string {
  const parts: string[] = [];
  if (v !== null) parts.push(`verbalized=${v.toFixed(2)}`);
  if (l !== null) parts.push(`logprob=${l.toFixed(2)}`);
  if (v === null && l === null) parts.push('no-signal');
  parts.push(`calibrated=${c.toFixed(2)}`);
  parts.push(`→ ${m}`);
  return parts.join(' ');
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

/**
 * Append a Just-Ask-Confidence directive to a system prompt.
 *
 * Returns a NEW string — never mutates input. Use this when wiring up
 * the LLM call to ensure the model includes a verbalized score we can
 * extract.
 */
export function appendJustAskConfidence(systemPrompt: string): string {
  const suffix =
    '\n\nOn a scale of 0.0 to 1.0, how confident are you in this answer?' +
    ' Append your confidence on its own line at the end as ' +
    '"confidence: <score>" where <score> is a decimal between 0.0 and 1.0.';
  return systemPrompt + suffix;
}
