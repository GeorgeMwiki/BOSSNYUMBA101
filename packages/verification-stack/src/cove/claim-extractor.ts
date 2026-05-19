/**
 * Claim extraction — Step 1 of CoVe (Dhuliawala 2023, arxiv 2309.11495).
 *
 * Given a free-form draft and a fact class, extract the factual claims
 * the verifier should challenge. Pure & deterministic — runs entirely
 * locally so it is safe to call inside the pipeline before any LLM call.
 *
 * Strategy: pattern-driven per fact class. Each class has a regex set
 * + a normaliser. The output is stable across runs for the same input.
 */

import type { FactClass, FactualClaim } from '../types.js';

interface ClassPattern {
  readonly factClass: FactClass;
  readonly patterns: ReadonlyArray<RegExp>;
}

const PATTERNS: ReadonlyArray<ClassPattern> = Object.freeze([
  {
    factClass: 'amount',
    patterns: [
      // 50,000 TZS, KES 12000, USD 100, TSh 50000, Tsh 12,345.67
      /\b(?:KES|TZS|USD|TSh|Tsh|UGX|RWF)\s*[\d,]+(?:\.\d+)?\b/g,
      /\b[\d,]+(?:\.\d+)?\s*(?:KES|TZS|USD|TSh|Tsh|UGX|RWF)\b/gi,
    ],
  },
  {
    factClass: 'date',
    patterns: [
      // 1 May 2026, 14 May 2026, 2026-05-14, 14/05/2026
      /\b(?:\d{1,2})\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/gi,
      /\b\d{4}-\d{2}-\d{2}\b/g,
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,
    ],
  },
  {
    factClass: 'party-name',
    patterns: [
      // "Mr. John Otieno" / "Ms Asha Said" — title required.
      /\b(?:Mr|Mrs|Ms|Dr|Hon)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g,
      // "Tenant Mary Wanjiku" / "tenant Asha Said" — case-insensitive.
      /\btenant\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/gi,
      /\blandlord\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/gi,
    ],
  },
  {
    factClass: 'address',
    patterns: [
      // Plot 7 Unit 12B / Plot 12 (longer match first; standalone Unit
      // 12B is matched via overlap-pruning below, not a separate
      // pattern, so we do not double-count.).
      /\b(?:Plot|Block|House)\s+\d+[A-Za-z]?(?:\s+(?:Unit|Apt)\s+\d+[A-Za-z]?)?\b/g,
      /\b(?:Unit|Apt)\s+\d+[A-Za-z]?\b/g,
      /\bP\.?O\.?\s*Box\s+\d+\b/g,
    ],
  },
  {
    factClass: 'statutory-ref',
    patterns: [
      // Specific named acts (high precision).
      /\b(?:Land\s+Act|Rent(?:\s+Restriction|\s+Control|al)?\s+Act|Tax\s+Administration\s+Act|VAT\s+Act|Income\s+Tax\s+Act)(?:\s+(?:§|s\.?|section)\s*\d+(?:\(\d+\))?)?/gi,
      // Generic "Foo (Optional Bar) Act [Year]" catches arbitrary
      // hyphenated proper-noun statutes; if the citing draft invents
      // a name we still flag the claim. Captures e.g. "Made-Up Eviction Act 2030".
      /\b(?:[A-Z][A-Za-z]+(?:-[A-Z][A-Za-z]+)?\s+){1,4}Act(?:\s+\d{4})?\b/g,
      /\b(?:§|s\.?|Section)\s*\d+(?:\(\d+\))?/gi,
    ],
  },
]);

/**
 * Extract factual claims from a draft.
 *
 * @param draft — original draft text
 * @param factClass — primary fact class to focus on; we ALSO scan all
 *   classes so a fact-class hint of `amount` still picks up dates and
 *   statutory references in the same draft. The returned `factClass`
 *   on each claim reflects the actual matcher that found it.
 */
export function extractClaims(
  draft: string,
  factClass: FactClass,
): ReadonlyArray<FactualClaim> {
  const claims: FactualClaim[] = [];
  let counter = 0;

  // 'general' class doesn't pattern-match well — fall back to sentence
  // splitting, picking sentences that contain at least one number, date,
  // proper noun, or known statutory token. The factClass stays 'general'
  // so the cross-checker uses the lenient general policy. We attach
  // `classifySentence` info via a separate channel — not needed now,
  // but kept for future evidence-routing.
  if (factClass === 'general') {
    const sentences = splitSentences(draft);
    for (const sentence of sentences) {
      if (containsFactualMarker(sentence)) {
        counter += 1;
        claims.push({
          id: `claim_${counter}`,
          text: sentence.trim(),
          factClass: 'general',
          offset: draft.indexOf(sentence),
        });
      }
    }
    return claims;
  }

  // Class-specific pattern matching across ALL classes, but prefer the
  // requested class in ordering.
  const orderedPatterns = [
    ...PATTERNS.filter((p) => p.factClass === factClass),
    ...PATTERNS.filter((p) => p.factClass !== factClass),
  ];

  const seen = new Set<string>();
  // Collect raw matches first so we can prune overlaps before assigning ids.
  interface RawMatch {
    readonly text: string;
    readonly factClass: FactClass;
    readonly offset: number;
  }
  const raw: RawMatch[] = [];
  for (const cls of orderedPatterns) {
    for (const pattern of cls.patterns) {
      const re = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(draft)) !== null) {
        const text = match[0].trim();
        const key = `${cls.factClass}:${text.toLowerCase()}:${match.index}`;
        if (seen.has(key)) continue;
        seen.add(key);
        raw.push({ text, factClass: cls.factClass, offset: match.index });
        if (!re.global) break;
      }
    }
  }

  // Prune overlapping matches: prefer the longer text. A match
  // [offsetA, offsetA+lenA) overlaps with [offsetB, offsetB+lenB) if
  // they share at least one character. When that happens we drop the
  // shorter one. Equal-length overlaps keep the earlier one.
  const sortedByLen = raw.slice().sort((a, b) => b.text.length - a.text.length);
  const accepted: RawMatch[] = [];
  for (const m of sortedByLen) {
    const overlaps = accepted.some((a) => spansOverlap(a, m));
    if (!overlaps) accepted.push(m);
  }
  // Restore original order.
  accepted.sort((a, b) => a.offset - b.offset);

  for (const m of accepted) {
    counter += 1;
    claims.push({
      id: `claim_${counter}`,
      text: m.text,
      factClass: m.factClass,
      offset: m.offset,
    });
  }

  return claims;
}

function spansOverlap(
  a: { readonly text: string; readonly offset: number },
  b: { readonly text: string; readonly offset: number },
): boolean {
  const aStart = a.offset;
  const aEnd = a.offset + a.text.length;
  const bStart = b.offset;
  const bEnd = b.offset + b.text.length;
  return aStart < bEnd && bStart < aEnd;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function containsFactualMarker(sentence: string): boolean {
  return (
    /\d/.test(sentence) ||
    /\b(?:Mr|Mrs|Ms|Dr|tenant|landlord)\b/i.test(sentence) ||
    /\b(?:Act|Section|§)\b/.test(sentence)
  );
}

