/**
 * Heuristic Constitutional Critic — deterministic adapter used by tests
 * and as a default when `@bossnyumba/central-intelligence`'s LLM
 * Constitutional Critic is not wired.
 *
 * Mirrors the K-E rule set verbatim (8 rules across tz-rental-act,
 * gdpr-pdpa, currency-chain, inviolable-ip). Each rule fires on a
 * keyword pattern with calibrated scores.
 *
 * In production, replace via the `ConstitutionalCriticPort` with the
 * LLM-backed implementation from `@bossnyumba/central-intelligence`.
 */

import type {
  ConstitutionalCheckInput,
  ConstitutionalCriticPort,
  CriticVerdictLike,
} from './types.js';

interface RuleSpec {
  readonly ruleId: string;
  readonly description: string;
  readonly violationKeywords: ReadonlyArray<RegExp>;
  readonly compliantKeywords: ReadonlyArray<RegExp>;
}

const RULES: ReadonlyArray<RuleSpec> = Object.freeze([
  {
    ruleId: 'tz-rental-act-notice-period',
    description: '14-day written notice required before non-payment eviction.',
    violationKeywords: [
      /\bimmediate(?:ly)?\s+evict/i,
      /\bevict\s+now\b/i,
      /\bno\s+notice\s+required/i,
      /\b(?:24|48|72)\s*hours?\b/i,
    ],
    compliantKeywords: [/\b14[-\s]?days?\s+notice\b/i, /\bstatutory\s+notice\b/i],
  },
  {
    ruleId: 'tz-rental-act-deposit-handling',
    description: 'Deposit refundable within 30 days of vacate.',
    violationKeywords: [
      /\bdeposit\s+forfeited\b/i,
      /\bdeposit\s+(?:will\s+be\s+)?kept\s+(?:forever|in full)/i,
    ],
    compliantKeywords: [/\bdeposit\s+(?:returned|refunded)/i],
  },
  {
    ruleId: 'tz-rental-act-advance-rent',
    description: 'No more than 6 months rent in advance.',
    violationKeywords: [
      /\b(?:7|8|9|10|11|12|24)\s+months?\s+(?:rent\s+)?(?:in\s+)?advance\b/i,
      /\b(?:one\s+year|two\s+years)\s+(?:rent\s+)?(?:in\s+)?advance\b/i,
    ],
    compliantKeywords: [],
  },
  {
    ruleId: 'gdpr-pii-boundary',
    description: 'PII never leaves owning tenant boundary.',
    violationKeywords: [
      /\bshare\s+(?:phone|email|id\s+number|passport)/i,
      /\bsend\s+(?:phone|email|id\s+number)\s+to\s+(?:another\s+tenant|third\s+party)/i,
    ],
    compliantKeywords: [],
  },
  {
    ruleId: 'gdpr-right-to-be-forgotten',
    description: 'Right-to-be-forgotten within 30 days.',
    violationKeywords: [
      /\bretain\s+(?:forever|indefinitely)/i,
      /\bnever\s+delete\b/i,
    ],
    compliantKeywords: [/\b30[-\s]?days?\s+deletion\b/i],
  },
  {
    ruleId: 'currency-chain-no-hardcode',
    description: 'Currency chain: user → tenant → platform default.',
    violationKeywords: [
      /\bhardcoded?\s+(?:fx|rate|currency)/i,
      /\bdefault(?:s)?\s+to\s+(?:TZS|USD|KES)\b(?!\s+(?:after|when|per))/i,
    ],
    compliantKeywords: [/\bnormaliseto\b/i, /\bcurrency_rates\s+table\b/i],
  },
  {
    ruleId: 'inviolable-ip-tenant-isolation',
    description: 'Cross-tenant data must not leak.',
    violationKeywords: [
      // Match "cross-tenant" only when NOT preceded by "no " / "without " / "never " / "is not".
      /(?<!\b(?:no|never|without|not|prevents|forbids)\s+)\b(?:cross|across)[-\s]tenant/i,
      /\b(?:other\s+tenant|another\s+tenant)'?s\s+(?:data|chat|lease)/i,
    ],
    compliantKeywords: [
      /\btenant\s+boundary\b/i,
      /\bno\s+cross[-\s]tenant\b/i,
      /\bwithin\s+the\s+tenant\b/i,
    ],
  },
  {
    ruleId: 'inviolable-ip-secret-redaction',
    description: 'Secrets, API keys, MPESA till numbers never in output.',
    violationKeywords: [
      /\bapi[\s_-]?key\s*[:=]\s*\S+/i,
      /\bmpesa[\s_-]?till\s*[:=]\s*\d+/i,
      /\bbank[\s_-]?account\s*[:=]\s*\d{6,}/i,
      /\bsk-[a-z0-9]{10,}/i,
    ],
    compliantKeywords: [],
  },
]);

export interface HeuristicCriticOptions {
  readonly tenantJurisdiction?: string;
}

export function heuristicConstitutionalCritic(
  options: HeuristicCriticOptions = {},
): ConstitutionalCriticPort {
  return {
    async score(input: ConstitutionalCheckInput): Promise<CriticVerdictLike> {
      const text = input.draft;
      const scores = RULES.map((rule) => {
        const hasViolation = rule.violationKeywords.some((rx) => rx.test(text));
        const hasCompliant = rule.compliantKeywords.some((rx) => rx.test(text));
        let score: number;
        let rationale: string;
        if (hasViolation && !hasCompliant) {
          score = 0.15;
          rationale = `Violation pattern matched: ${rule.description}`;
        } else if (hasViolation && hasCompliant) {
          score = 0.55;
          rationale = `Mixed signal — violation + compliant patterns both present.`;
        } else if (hasCompliant) {
          score = 1;
          rationale = `Compliant pattern present.`;
        } else {
          score = 0.95;
          rationale = `No pattern matched; default pass.`;
        }
        return { ruleId: rule.ruleId, score, rationale };
      });
      const overall = scores.reduce((s, r) => s + r.score, 0) / scores.length;
      const passed = overall >= 0.7 && scores.every((s) => s.score >= 0.55);
      // Hint we read tenant jurisdiction for forward-compat; not used now.
      void options.tenantJurisdiction;
      return { overall, passed, scores };
    },
  };
}
