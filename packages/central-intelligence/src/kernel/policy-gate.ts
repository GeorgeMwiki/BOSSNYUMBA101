/**
 * Policy gate — deterministic OUTPUT validation. Runs after the
 * sensor returns and before the kernel commits the answer. Three
 * concerns, in order:
 *
 *   1. PII redaction — phone / national-id / email leakage that the
 *      sensor accidentally reproduced from a tool result.
 *   2. Numerical claim hedging — un-cited absolute numbers ("rent
 *      collection is 92.3%") get softened to a range or a hedge.
 *   3. Regulatory-tone hedging — eviction / termination language gets
 *      a mandatory pointer to the documented arrears ladder.
 *
 * The gate is a pure function. It returns an outcome describing what
 * was done so the kernel can decide whether the result is "pass",
 * "soften", or "block". Heavy redaction work delegates to existing
 * pii-scrubber semantics (re-implemented here with a small kernel-
 * scoped pattern set so this package stays free of cross-package
 * runtime imports).
 */

import type { GateVerdict } from './kernel-types.js';

export interface PolicyGateInput {
  readonly text: string;
  readonly hasCitations: boolean;
}

export interface PolicyGateOutput {
  readonly verdict: GateVerdict;
  readonly redactedText: string;
  readonly mutations: ReadonlyArray<string>;
}

const PII_PATTERNS: ReadonlyArray<{ kind: string; re: RegExp; replace: string }> = [
  { kind: 'phone-tz',  re: /\+?255[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}/g, replace: '[redacted-phone]' },
  { kind: 'phone-ke',  re: /\+?254[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}/g, replace: '[redacted-phone]' },
  { kind: 'phone-gen', re: /\b0[67]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g,    replace: '[redacted-phone]' },
  { kind: 'email',     re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,  replace: '[redacted-email]' },
  { kind: 'nida',      re: /\b\d{8}-\d{5}-\d{5}-\d{2}\b/g,             replace: '[redacted-nida]' },
];

const NUMERICAL_PATTERN = /\b\d{1,3}(?:[.,]\d+)?%/g; // 92.3% etc
const ABSOLUTE_MONEY_PATTERN = /\b(TZS|KES|USD)\s?\d[\d,]*\b/g;

const REGULATORY_TRIGGERS: ReadonlyArray<RegExp> = [
  /\bevict\w*/i,
  /\bterminate? (the )?lease\b/i,
  /\bvacate (the )?premises\b/i,
  /\blockout\b/i,
];

export function runPolicyGate(input: PolicyGateInput): PolicyGateOutput {
  let text = input.text;
  const mutations: string[] = [];

  for (const p of PII_PATTERNS) {
    if (p.re.test(text)) {
      text = text.replace(p.re, p.replace);
      mutations.push(`redacted:${p.kind}`);
    }
  }

  if (!input.hasCitations) {
    if (NUMERICAL_PATTERN.test(text)) {
      mutations.push('hedged:uncited-percentage');
      text = text.replace(
        NUMERICAL_PATTERN,
        (m) => `${m} (uncited — verify against the source tool)`,
      );
    }
    if (ABSOLUTE_MONEY_PATTERN.test(text)) {
      mutations.push('hedged:uncited-money');
      text = text.replace(
        ABSOLUTE_MONEY_PATTERN,
        (m) => `${m} (uncited — verify against the ledger)`,
      );
    }
  }

  let regulatoryHit = false;
  for (const re of REGULATORY_TRIGGERS) {
    if (re.test(text)) {
      regulatoryHit = true;
      break;
    }
  }
  if (regulatoryHit && !/arrears ladder|notice period|tribunal/i.test(text)) {
    text =
      text.trimEnd() +
      '\n\nNote: any termination action must follow the documented arrears ladder and notice period. I am not the decision-maker for those steps.';
    mutations.push('appended:regulatory-hedge');
  }

  let verdict: GateVerdict;
  if (mutations.some((m) => m.startsWith('redacted:'))) {
    verdict = { status: 'soften', reason: 'PII redacted in output' };
  } else if (mutations.length > 0) {
    verdict = { status: 'soften', reason: 'output hedged for regulatory or citation safety' };
  } else {
    verdict = { status: 'pass' };
  }

  return { verdict, redactedText: text, mutations };
}
