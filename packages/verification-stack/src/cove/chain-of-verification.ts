/**
 * Chain-of-Verification (CoVe) — Dhuliawala 2023, arxiv 2309.11495.
 *
 * 5-step flow:
 *   1. Identify all factual claims in `draft`.
 *   2. Generate 3-5 independent verification questions per claim.
 *   3. Answer each question in isolation (NEW LLM context, no draft).
 *   4. Cross-check answers against original claim.
 *   5. Revise draft; surface unverifiable claims as `[NEEDS_VERIFY]`.
 *
 * Closes L1 #4 and L3 #4.
 */

import type {
  ClaimVerification,
  FactClass,
  FactualClaim,
  VerifiedDraft,
  Verdict,
} from '../types.js';
import { systemClock, type Clock } from '../ports/clock.js';
import { extractClaims } from './claim-extractor.js';
import { generateVerificationQuestions } from './question-generator.js';
import {
  type AnswererPort,
  type IndependentAnswer,
} from './independent-answerer.js';

export interface CoveDeps {
  readonly answerer: AnswererPort;
  readonly clock?: Clock;
  /** Minimum confidence to count an answer as "verified". Default 0.6. */
  readonly minAnswerConfidence?: number;
  /** Minimum confidence across all answers to call a claim verified. Default 0.55. */
  readonly minClaimConfidence?: number;
  /** Cap questions per claim. Default 5. */
  readonly maxQuestionsPerClaim?: number;
  /** Floor on questions per claim. Default 3. */
  readonly minQuestionsPerClaim?: number;
}

const DEFAULTS = {
  minAnswerConfidence: 0.6,
  minClaimConfidence: 0.55,
  maxQuestionsPerClaim: 5,
  minQuestionsPerClaim: 3,
} as const;

/**
 * Run CoVe on a draft.
 *
 * The returned `VerifiedDraft` always includes the original + revised
 * draft, the claim list, the verification record per claim, and a
 * verdict (`pass` if all claims verified, `flag` if any claim could
 * not be verified — never `fail` outright: CoVe surfaces uncertainty
 * rather than blocking).
 */
export async function chainOfVerification(
  draft: string,
  factClass: FactClass,
  deps: CoveDeps,
): Promise<VerifiedDraft> {
  const clock = deps.clock ?? systemClock;
  const start = clock.monotonicMs();
  const minAns = deps.minAnswerConfidence ?? DEFAULTS.minAnswerConfidence;
  const minClaim = deps.minClaimConfidence ?? DEFAULTS.minClaimConfidence;
  const maxQ = deps.maxQuestionsPerClaim ?? DEFAULTS.maxQuestionsPerClaim;
  const minQ = deps.minQuestionsPerClaim ?? DEFAULTS.minQuestionsPerClaim;

  // Step 1: extract claims
  const claims = extractClaims(draft, factClass);

  if (claims.length === 0) {
    return {
      originalDraft: draft,
      revisedDraft: draft,
      factClass,
      claims: [],
      verifications: [],
      verdict: 'pass',
      unverifiedClaims: [],
      elapsedMs: clock.monotonicMs() - start,
    };
  }

  // Steps 2-3: per claim, generate questions and answer each in isolation
  const verifications: ClaimVerification[] = [];
  for (const claim of claims) {
    const questions = generateVerificationQuestions(claim).slice(0, maxQ);
    const questionsToAsk = questions.length >= minQ ? questions : questions; // pattern-driven; trust pattern
    const answers: IndependentAnswer[] = [];
    for (const question of questionsToAsk) {
      const ans = await deps.answerer.answer(claim, question);
      answers.push(ans);
    }

    // Step 4: cross-check
    const { verified, confidence, rationale } = crossCheck(
      claim,
      answers,
      minAns,
      minClaim,
    );

    verifications.push({
      claimId: claim.id,
      claim: claim.text,
      questions: questionsToAsk,
      answers: answers.map((a) => a.answer),
      verified,
      confidence,
      rationale,
    });
  }

  // Step 5: revise draft
  const { revisedDraft, unverifiedClaims } = reviseDraft(draft, claims, verifications);

  const verdict: Verdict = unverifiedClaims.length === 0 ? 'pass' : 'flag';

  return {
    originalDraft: draft,
    revisedDraft,
    factClass,
    claims,
    verifications,
    verdict,
    unverifiedClaims,
    elapsedMs: clock.monotonicMs() - start,
  };
}

function crossCheck(
  claim: FactualClaim,
  answers: ReadonlyArray<IndependentAnswer>,
  minAnswerConfidence: number,
  minClaimConfidence: number,
): { verified: boolean; confidence: number; rationale: string } {
  if (answers.length === 0) {
    return {
      verified: false,
      confidence: 0,
      rationale: 'No verification questions answered.',
    };
  }

  const usable = answers.filter((a) => a.confidence >= minAnswerConfidence);
  if (usable.length === 0) {
    return {
      verified: false,
      confidence: 0,
      rationale: `No answer reached minAnswerConfidence (${minAnswerConfidence.toFixed(2)}).`,
    };
  }

  // Negation: an answer that says "no record", "has no", "does not",
  // "no entry", "no such", "not found" rejects the claim regardless of
  // token overlap.
  const allRejected = usable.every((a) => answerNegatesClaim(a.answer));
  if (allRejected) {
    const avgConfidence =
      usable.reduce((s, a) => s + a.confidence, 0) / usable.length;
    return {
      verified: false,
      confidence: Math.min(avgConfidence, 0.4),
      rationale: `All answers explicitly reject the claim "${claim.text}".`,
    };
  }

  // Drop rejecting answers from the support set.
  const supporting = usable.filter((a) => !answerNegatesClaim(a.answer));
  if (supporting.length === 0) {
    return {
      verified: false,
      confidence: 0,
      rationale: `No supporting answer for "${claim.text}".`,
    };
  }

  // For amount/date/statutory-ref claims we require the claim's literal
  // text to appear in at least one usable answer. For party-name +
  // address we accept any high-confidence affirmation. For 'general',
  // we accept majority-affirmative usable answers.
  const literalMatch = supporting.some((a) =>
    answerSupportsClaim(claim, a.answer),
  );
  const averageConfidence =
    supporting.reduce((s, a) => s + a.confidence, 0) / supporting.length;

  if (claim.factClass === 'amount' ||
      claim.factClass === 'date' ||
      claim.factClass === 'statutory-ref') {
    const verified = literalMatch && averageConfidence >= minClaimConfidence;
    return {
      verified,
      confidence: verified ? averageConfidence : Math.min(averageConfidence, 0.4),
      rationale: verified
        ? `Literal-match verified by ${usable.length} answer(s); avg confidence ${averageConfidence.toFixed(2)}.`
        : `Claim "${claim.text}" not supported by any answer; potential hallucination.`,
    };
  }

  // For 'general' we are lenient — high-confidence affirmation is
  // enough, even without a token overlap.
  if (claim.factClass === 'general') {
    const verified = averageConfidence >= minClaimConfidence;
    return {
      verified,
      confidence: verified ? averageConfidence : Math.min(averageConfidence, 0.5),
      rationale: verified
        ? `Supported by ${supporting.length} independent answer(s); avg confidence ${averageConfidence.toFixed(2)}.`
        : `Insufficient support; avg confidence ${averageConfidence.toFixed(2)} below threshold.`,
    };
  }

  // party-name / address — require literal token overlap.
  const verified = averageConfidence >= minClaimConfidence && literalMatch;
  return {
    verified,
    confidence: verified ? averageConfidence : Math.min(averageConfidence, 0.5),
    rationale: verified
      ? `Supported by ${supporting.length} independent answer(s); avg confidence ${averageConfidence.toFixed(2)}.`
      : `Insufficient support; avg confidence ${averageConfidence.toFixed(2)} below threshold.`,
  };
}

function answerNegatesClaim(answer: string): boolean {
  const lower = answer.toLowerCase();
  return (
    /\bno\s+(?:record|entry|such|matching|ledger|trace|history|listing)\b/.test(lower) ||
    /\bhas\s+no\b/.test(lower) ||
    /\bdoes\s+not\s+(?:have|exist|match|appear)\b/.test(lower) ||
    /\bdo\s+not\s+(?:have|exist|match|appear)\b/.test(lower) ||
    /\bnot\s+(?:found|listed|registered)\b/.test(lower) ||
    /\bcannot\s+(?:find|locate)\b/.test(lower) ||
    /\bnever\s+(?:appeared|existed|registered)\b/.test(lower)
  );
}

/**
 * Token-level support check. We do NOT require an exact string match;
 * we require the key tokens of the claim to appear in the answer
 * (e.g. claim "50,000 TZS" → answer "the rent is 50000 TZS" is a hit).
 */
function answerSupportsClaim(claim: FactualClaim, answer: string): boolean {
  const claimTokens = normalise(claim.text)
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (claimTokens.length === 0) return false;
  const answerNorm = normalise(answer);
  const hits = claimTokens.filter((t) => answerNorm.includes(t)).length;
  return hits / claimTokens.length >= 0.5;
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[,.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function reviseDraft(
  draft: string,
  claims: ReadonlyArray<FactualClaim>,
  verifications: ReadonlyArray<ClaimVerification>,
): { revisedDraft: string; unverifiedClaims: string[] } {
  const verificationByClaimId = new Map(verifications.map((v) => [v.claimId, v]));
  const unverifiedClaims: string[] = [];
  let revised = draft;

  // Walk claims in REVERSE offset order so earlier offsets stay stable.
  const ordered = claims
    .filter((c) => typeof c.offset === 'number')
    .slice()
    .sort((a, b) => (b.offset ?? 0) - (a.offset ?? 0));

  for (const claim of ordered) {
    const v = verificationByClaimId.get(claim.id);
    if (!v || v.verified) continue;
    const offset = claim.offset!;
    const before = revised.slice(0, offset);
    const target = revised.slice(offset, offset + claim.text.length);
    const after = revised.slice(offset + claim.text.length);
    // Only annotate if the slice still matches (defensive — patterns
    // might have over-included whitespace).
    if (target === claim.text) {
      revised = `${before}${claim.text} [NEEDS_VERIFY]${after}`;
      unverifiedClaims.push(claim.text);
    } else {
      unverifiedClaims.push(claim.text);
    }
  }

  // Claims with no offset (rare — fallback from 'general' sentence-split)
  // get a footer annotation instead.
  for (const claim of claims) {
    if (typeof claim.offset === 'number') continue;
    const v = verificationByClaimId.get(claim.id);
    if (!v || v.verified) continue;
    unverifiedClaims.push(claim.text);
    if (!revised.includes('[NEEDS_VERIFY]')) {
      revised = `${revised}\n[NEEDS_VERIFY] ${claim.text}`;
    }
  }

  return { revisedDraft: revised, unverifiedClaims };
}
