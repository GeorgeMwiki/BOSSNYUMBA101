/**
 * Pattern library for the Tier-1 local input shield.
 *
 * L3 §3.2 — when Lakera Guard API is unavailable (no key, offline), fall
 * back to a regex/heuristic classifier. The pattern catalog mirrors:
 *
 *   - INJECAGENT (Liu et al. 2024) — indirect prompt-injection attacks
 *   - Pyrit (Microsoft) — adversarial prompt taxonomy
 *   - Gandalf (Lakera) — direct-jailbreak corpus
 *   - OWASP LLM Top-10 (2025) — categorisation
 *
 * Patterns are *high-precision* (low false-positive). We accept ~70%
 * recall here because Tier-1 is the cheap edge filter; the rest of the
 * stack (Tier-2 spotlighting + Tier-3 anomaly probe) catches the
 * 30% that slips through.
 */

import type { ShieldCategory } from '../types.js';

export interface ShieldPattern {
  readonly regex: RegExp;
  readonly category: ShieldCategory;
  readonly signal: string;
  readonly weight: number;
}

/**
 * The pattern catalog. Each pattern carries a `weight` — the shield
 * sums weights of all firing patterns to produce a score. A score above
 * the threshold (0.6) blocks; below, passes with the score recorded.
 *
 * Frozen so the catalog can be shared safely.
 */
export const SHIELD_PATTERNS: ReadonlyArray<ShieldPattern> = Object.freeze([
  // ---- Direct prompt injection (LLM01) ----
  {
    regex: /ignore\s+(?:all\s+|the\s+)?(?:previous|prior|above)\s+(?:instructions?|prompts?|messages?|rules?)/i,
    category: 'prompt-injection',
    signal: 'ignore-previous-directive',
    weight: 0.9,
  },
  {
    regex: /disregard\s+(?:all\s+)?(?:previous|prior|above|the)\s+(?:instructions?|system\s+prompts?|rules?)/i,
    category: 'prompt-injection',
    signal: 'disregard-previous-directive',
    weight: 0.9,
  },
  {
    regex: /forget\s+(?:everything|all)\s+(?:before|above|prior|previous)/i,
    category: 'prompt-injection',
    signal: 'forget-everything',
    weight: 0.85,
  },
  {
    regex: /you\s+are\s+(?:now|hereby)\s+(?:a\s+)?(?:different|new)\s+(?:ai|assistant|model|character)/i,
    category: 'role-confusion',
    signal: 'role-switch-attempt',
    weight: 0.85,
  },
  {
    regex: /(?:act|behave|roleplay|pretend)\s+(?:as|to\s+be)\s+(?:if\s+you\s+(?:are|were)\s+)?(?:a|an)?\s*(?:different|evil|jailbroken|uncensored|unrestricted|new|DAN|do[\s-]?anything[\s-]?now)/i,
    category: 'jailbreak',
    signal: 'persona-jailbreak',
    weight: 0.9,
  },
  {
    regex: /\bDAN\s+(?:mode|prompt|persona)/i,
    category: 'jailbreak',
    signal: 'dan-keyword',
    weight: 0.85,
  },
  // DAN as a stand-alone reference (e.g. "As DAN, ignore...")
  {
    regex: /\bas\s+DAN\b/i,
    category: 'jailbreak',
    signal: 'dan-as-persona',
    weight: 0.85,
  },
  {
    regex: /developer[\s-]?(?:mode|override)/i,
    category: 'jailbreak',
    signal: 'developer-mode',
    weight: 0.8,
  },
  {
    regex: /(?:no|without|bypass|skip|override)\s+(?:any|all)?\s*(?:safety|content|moderation|ethical)\s+(?:filter|guideline|policy|restriction|guardrail)/i,
    category: 'jailbreak',
    signal: 'safety-bypass',
    weight: 0.9,
  },

  // ---- System prompt leakage (LLM07) ----
  {
    regex: /(?:show|reveal|display|print|repeat|tell)\s+(?:me\s+)?(?:your|the)\s+(?:system\s+prompt|initial\s+(?:instructions?|prompts?)|hidden\s+(?:prompt|instructions?)|guidelines?)/i,
    category: 'system-prompt-leak',
    signal: 'system-prompt-extraction',
    weight: 0.85,
  },
  {
    regex: /what\s+is\s+(?:your|the)\s+(?:system\s+prompt|initial\s+(?:instructions?|prompts?)|hidden\s+(?:prompt|instructions?)|guidelines?)/i,
    category: 'system-prompt-leak',
    signal: 'system-prompt-question',
    weight: 0.85,
  },
  {
    regex: /repeat\s+(?:back|verbatim)\s+(?:the|your)\s+(?:initial|original|system)\s+(?:system\s+)?(?:prompt|message|instructions?)/i,
    category: 'system-prompt-leak',
    signal: 'repeat-system-prompt',
    weight: 0.85,
  },

  // ---- Goal hijacking ----
  {
    regex: /your\s+(?:new|real|true|actual)\s+(?:goal|objective|task|purpose|mission)\s+is/i,
    category: 'goal-hijack',
    signal: 'new-goal-directive',
    weight: 0.85,
  },
  {
    regex: /from\s+now\s+on,?\s+(?:you|your)/i,
    category: 'goal-hijack',
    signal: 'from-now-on-directive',
    weight: 0.7,
  },

  // ---- Indirect / embedded injection markers ----
  {
    regex: /<\s*(?:system|prompt|instruction)\s*>/i,
    category: 'indirect-injection',
    signal: 'embedded-system-tag',
    weight: 0.7,
  },
  {
    regex: /###\s*(?:system|admin|root|sudo)\s*[:#]/i,
    category: 'indirect-injection',
    signal: 'admin-marker',
    weight: 0.7,
  },

  // ---- Tool-call injection ----
  {
    regex: /(?:execute|run|invoke|call)\s+(?:the\s+)?(?:tool|function|command)\s+["']?[\w-]+["']?\s+with/i,
    category: 'tool-call-injection',
    signal: 'tool-call-directive',
    weight: 0.6,
  },
  {
    regex: /\{\s*"tool"\s*:\s*"[\w-]+"\s*,/i,
    category: 'tool-call-injection',
    signal: 'tool-json-injection',
    weight: 0.7,
  },

  // ---- PII bait ----
  {
    regex: /(?:tell|show|give)\s+me\s+(?:the\s+)?(?:phone|email|address|ssn|kra\s*pin|nida|password|api\s*key)\s+(?:of|for)\s+/i,
    category: 'pii-bait',
    signal: 'pii-exfil-attempt',
    weight: 0.8,
  },
  {
    regex: /list\s+(?:all\s+)?(?:tenants?|users?|customers?)\s+(?:with|that\s+have)\s+(?:their\s+)?(?:phone|email|address|kra)/i,
    category: 'pii-bait',
    signal: 'pii-bulk-extract',
    weight: 0.85,
  },

  // ---- Common jailbreak suffix markers ----
  {
    regex: /\[\[\s*(?:JAILBREAK|UNFILTERED|UNRESTRICTED)\s*\]\]/i,
    category: 'jailbreak',
    signal: 'jailbreak-marker',
    weight: 0.95,
  },
  {
    regex: /Sure[,!]?\s+here\s+is\s+how\s+to/i,
    category: 'jailbreak',
    signal: 'prefix-injection-suffix',
    weight: 0.5,
  },
]);

/**
 * Block threshold. Cumulative weight at or above this value → block.
 *
 * Chosen empirically: a single high-weight pattern (e.g. "ignore previous")
 * at 0.9 fires alone → block. Two medium signals (0.5 + 0.5 = 1.0) → block.
 * One medium signal (0.5) alone passes (recorded for telemetry).
 */
export const SHIELD_BLOCK_THRESHOLD = 0.6;
