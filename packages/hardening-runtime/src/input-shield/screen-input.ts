/**
 * screenInput — Tier-1 input shield (Lakera/Rebuff pattern).
 *
 * L3 §8 #2 — blocks 98% of prompt-injection at the edge (score 12.5).
 *
 * Wired into all chat-entry surfaces:
 *   - chat-workspace J9 (Web)
 *   - WhatsApp webhook
 *   - MCP entry
 *
 * If a `LakeraClient` is wired in (commercial API), we delegate. If not,
 * we fall back to the local regex/heuristic shield in `./patterns.ts`.
 *
 * Defense-in-depth contract (L3 §3 principle #1): even the BEST single
 * shield breaks against AmpleGCG / GCG attacks at 80–99% ASR. Tier-1 is
 * the cheap edge filter. Tier-2 (spotlighting) + Tier-3 (anomaly probe)
 * catch what slips through.
 */

import type { ShieldCategory, ShieldVerdict } from '../types.js';
import { SHIELD_BLOCK_THRESHOLD, SHIELD_PATTERNS } from './patterns.js';

/**
 * Optional Lakera-style client port. When wired, we prefer it over
 * the local heuristic.
 */
export interface LakeraClient {
  /**
   * Classify text and return either `pass` (with score) or `block`
   * (with category + reason).
   */
  classify(text: string): Promise<ShieldVerdict>;
}

export interface ScreenInputOptions {
  /** Lakera-style commercial classifier client (optional). */
  readonly lakera?: LakeraClient;
  /** Override the cumulative-weight block threshold for testing. */
  readonly blockThreshold?: number;
  /** Max input length to scan. Defaults to 50_000 chars (≈12k tokens). */
  readonly maxLength?: number;
}

/**
 * Screen a user-input string for prompt-injection / jailbreak / PII-bait /
 * indirect-injection / role-confusion / goal-hijack / tool-call-injection
 * / system-prompt-leak.
 *
 * Returns a frozen `ShieldVerdict`:
 *   - `{ outcome: 'pass', score, signals }` — pass through.
 *   - `{ outcome: 'block', category, reason, score, signals }` — refuse.
 *
 * Wire-side callers MUST honor `outcome === 'block'` — never forward to
 * the LLM. Surface a generic refusal to the user.
 */
export async function screenInput(
  text: string,
  options: ScreenInputOptions = {},
): Promise<ShieldVerdict> {
  // Defensive truncation — patterns are O(n) and a 1MB input would be
  // pathological. Truncate before scanning; tag a signal.
  const maxLength = options.maxLength ?? 50_000;
  const trimmed =
    text.length > maxLength ? text.slice(0, maxLength) : text;

  // Prefer Lakera when wired.
  if (options.lakera) {
    try {
      return Object.freeze(await options.lakera.classify(trimmed));
    } catch {
      // Fall through to local heuristic — never let a 3rd-party outage
      // become a hardening regression.
    }
  }

  return screenLocal(trimmed, options.blockThreshold);
}

/**
 * Local fallback classifier. Pure function — no side-effects.
 */
function screenLocal(
  text: string,
  blockThreshold: number = SHIELD_BLOCK_THRESHOLD,
): ShieldVerdict {
  if (!text || text.trim().length === 0) {
    return Object.freeze({
      outcome: 'pass',
      score: 0,
      signals: Object.freeze([]),
    });
  }

  const firedSignals: string[] = [];
  const firedCategories: ShieldCategory[] = [];
  let cumulativeScore = 0;
  let topPatternWeight = 0;
  let topPatternCategory: ShieldCategory | null = null;
  let topPatternSignal = '';

  for (const pattern of SHIELD_PATTERNS) {
    if (pattern.regex.test(text)) {
      firedSignals.push(pattern.signal);
      firedCategories.push(pattern.category);
      cumulativeScore += pattern.weight;
      if (pattern.weight > topPatternWeight) {
        topPatternWeight = pattern.weight;
        topPatternCategory = pattern.category;
        topPatternSignal = pattern.signal;
      }
    }
  }

  // Block decision — either a single high-weight signal (≥0.85) trips,
  // or the cumulative weight crosses the threshold.
  const blocked =
    topPatternWeight >= 0.85 || cumulativeScore >= blockThreshold;

  if (blocked && topPatternCategory !== null) {
    return Object.freeze({
      outcome: 'block',
      category: topPatternCategory,
      reason:
        `Local shield blocked: matched ${firedSignals.length} pattern(s);` +
        ` top signal="${topPatternSignal}" (weight ${topPatternWeight.toFixed(2)});` +
        ` cumulative score ${cumulativeScore.toFixed(2)}`,
      score: Math.min(1, cumulativeScore),
      signals: Object.freeze([...firedSignals]),
    });
  }

  return Object.freeze({
    outcome: 'pass',
    score: Math.min(1, cumulativeScore),
    signals: Object.freeze([...firedSignals]),
  });
}
