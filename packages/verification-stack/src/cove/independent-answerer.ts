/**
 * Independent answerer — Step 3 of CoVe.
 *
 * Each verification question is answered in a FRESH context with NO
 * view of the original draft. This is the critical innovation that
 * cuts cross-bias hallucinations (Dhuliawala 2023: "factored" variant
 * wins 50-70% hallucination cut).
 *
 * The answerer accepts a port. We expose two ports:
 *   - `LlmAnswerPort` — calls the wired LLM with a system prompt that
 *     CANNOT include the draft.
 *   - `EvidenceAnswerPort` — calls a tenant-data lookup function
 *     (preferred for amount/date/party-name claims). Keeps the answer
 *     deterministic & cheap.
 *
 * Both ports return `IndependentAnswer`. The CoVe coordinator picks the
 * stronger of the two when both are wired.
 */

import type { FactualClaim } from '../types.js';
import { extractText, type LlmClient } from '../ports/llm-client.js';

export interface IndependentAnswer {
  readonly question: string;
  readonly answer: string;
  /** 0..1 — answerer's own confidence. */
  readonly confidence: number;
  readonly source: 'llm' | 'evidence' | 'no-data';
}

export interface LlmAnswererArgs {
  readonly llm: LlmClient;
  readonly model: string;
  readonly maxTokens?: number;
}

export interface EvidenceAnswererArgs {
  /**
   * Pure function from (claim, question) → (answer, confidence) | null.
   * Returning null = no evidence; CoVe will fall back to LLM (if wired)
   * or surface as `[NEEDS_VERIFY]`.
   */
  readonly lookup: (
    claim: FactualClaim,
    question: string,
  ) => { readonly answer: string; readonly confidence: number } | null;
}

export interface AnswererPort {
  answer(
    claim: FactualClaim,
    question: string,
  ): Promise<IndependentAnswer>;
}

/**
 * LLM-backed answerer. CRITICAL: the system prompt forbids reading
 * the original draft. The user message contains ONLY the question.
 */
export function llmAnswerer(args: LlmAnswererArgs): AnswererPort {
  const maxTokens = args.maxTokens ?? 256;
  return {
    async answer(claim, question): Promise<IndependentAnswer> {
      try {
        const resp = await args.llm.messages.create({
          model: args.model,
          max_tokens: maxTokens,
          system:
            'You are a verification answerer. You MUST NOT see or assume a prior draft. ' +
            'Answer the verification question using only general knowledge or the data sources you can name. ' +
            'If you do not know, say "I do not know" — never guess. ' +
            'Reply with: <answer text>\nConfidence: 0..1',
          messages: [
            {
              role: 'user',
              content: question,
            },
          ],
        });
        const text = extractText(resp);
        const { answer, confidence } = parseAnswer(text);
        return {
          question,
          answer,
          confidence,
          source: 'llm',
        };
      } catch {
        return {
          question,
          answer: 'no-data',
          confidence: 0,
          source: 'no-data',
        };
      }
    },
  };
}

/**
 * Evidence-source answerer — preferred for deterministic checks against
 * the property ledger / lease repository / notice register. Tests inject
 * a static lookup map.
 */
export function evidenceAnswerer(args: EvidenceAnswererArgs): AnswererPort {
  return {
    async answer(claim, question): Promise<IndependentAnswer> {
      const hit = args.lookup(claim, question);
      if (!hit) {
        return {
          question,
          answer: 'no-data',
          confidence: 0,
          source: 'no-data',
        };
      }
      return {
        question,
        answer: hit.answer,
        confidence: hit.confidence,
        source: 'evidence',
      };
    },
  };
}

/**
 * Compose multiple answerers — first non-zero-confidence wins.
 */
export function chainAnswerers(...answerers: AnswererPort[]): AnswererPort {
  return {
    async answer(claim, question): Promise<IndependentAnswer> {
      let best: IndependentAnswer | null = null;
      for (const a of answerers) {
        const ans = await a.answer(claim, question);
        if (ans.confidence > 0 && (best === null || ans.confidence > best.confidence)) {
          best = ans;
        }
      }
      return (
        best ?? {
          question,
          answer: 'no-data',
          confidence: 0,
          source: 'no-data',
        }
      );
    },
  };
}

function parseAnswer(text: string): { answer: string; confidence: number } {
  const lines = text.split(/\n+/);
  const confLine = lines.find((l) => /confidence/i.test(l));
  let confidence = 0.5;
  if (confLine) {
    const m = /([01](?:\.\d+)?)/.exec(confLine);
    if (m && m[1] !== undefined) {
      const parsed = parseFloat(m[1]);
      if (Number.isFinite(parsed)) {
        confidence = Math.min(1, Math.max(0, parsed));
      }
    }
  }
  const answer = lines
    .filter((l) => !/confidence/i.test(l))
    .join(' ')
    .trim();
  if (/i do not know/i.test(answer) || answer.length === 0) {
    return { answer: answer || 'I do not know', confidence: 0 };
  }
  return { answer, confidence };
}
