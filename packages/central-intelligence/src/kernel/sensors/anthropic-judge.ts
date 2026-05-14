/**
 * Anthropic Haiku judge — LLM-as-judge for high-stakes decisions.
 *
 * Mirrors LITFIN's self-review judge pass. The kernel passes the
 * sensor's draft answer to the judge, which returns a numeric score
 * in [0,1] indicating how well the answer satisfies the question
 * with citations and clarity. The kernel uses this score in the
 * confidence vector's `review` component.
 *
 * Wave-K parity update: the judge now returns `{score, reasonText,
 * suggestedFix}` so the kernel can bake the rejection feedback into
 * a single regeneration attempt when the score falls below a
 * stakes-driven floor (mirrors LITFIN `brain-kernel.ts:1190-1240`).
 *
 * Pure adapter; the kernel itself stays provider-agnostic.
 */

import type { AnthropicMessagesClient } from './anthropic-sensor.js';

export interface AnthropicJudgeConfig {
  readonly modelId?: string;
  readonly maxTokens?: number;
}

export interface JudgeVerdict {
  readonly score: number;
  /** Human-readable rationale from the judge (≤ 1-2 sentences). */
  readonly reasonText: string;
  /**
   * Concrete instruction the judge would give the sensor to fix the
   * draft. Used by the kernel as a "regen feedback" baked into the
   * follow-up prompt. Empty string when the judge declines to suggest.
   */
  readonly suggestedFix: string;
}

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You are a quality judge for property-management AI answers. You read a draft answer and return a single JSON object: {"score": NUMBER, "reasonText": STRING, "suggestedFix": STRING}.

The score is in [0, 1]:
  1.0 — every factual claim is grounded; tone matches a property-ops voice; no fabrication.
  0.7 — mostly grounded; some uncited claims, but no hallucination.
  0.4 — partial grounding; reasonable structure; at least one clear hedge missing.
  0.0 — fabrications, off-topic, or refuses without justification.

"reasonText" is one short sentence (≤ 25 words) explaining the score.
"suggestedFix" is a one-sentence imperative instruction the property-ops AI could follow to lift the score; empty string if the draft already scores ≥ 0.9.

Return ONLY the JSON object. No markdown. No commentary.`;

export function createAnthropicJudge(
  client: AnthropicMessagesClient,
  config: AnthropicJudgeConfig = {},
): (text: string) => Promise<JudgeVerdict> {
  const modelId = config.modelId ?? DEFAULT_MODEL;
  const maxTokens = config.maxTokens ?? 512;

  return async function judge(text: string): Promise<JudgeVerdict> {
    if (!text.trim()) {
      return { score: 0, reasonText: 'empty draft', suggestedFix: 'Produce a response — the draft is empty.' };
    }
    try {
      const response = await client.messages.create({
        model: modelId,
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Draft answer to evaluate:\n\n${text}\n\nReturn the JSON object now.`,
          },
        ],
      });
      let body = '';
      for (const block of response.content) {
        if (block.type === 'text' && typeof block.text === 'string') body += block.text;
      }
      const parsed = parseJudgeResponse(body);
      return {
        score: clamp01(parsed.score),
        reasonText: parsed.reasonText,
        suggestedFix: parsed.suggestedFix,
      };
    } catch {
      // A judge failure must not break the main turn; fall back to
      // the neutral 1.0 (kernel uses min(...components), so 1.0 means
      // "judge did not constrain confidence").
      return { score: 1, reasonText: '', suggestedFix: '' };
    }
  };
}

function parseJudgeResponse(body: string): { score: number; reasonText: string; suggestedFix: string } {
  const match = body.match(/\{[\s\S]*\}/);
  if (!match) return { score: 1, reasonText: '', suggestedFix: '' };
  try {
    const obj = JSON.parse(match[0]) as {
      score?: unknown;
      reasonText?: unknown;
      reasons?: unknown;
      suggestedFix?: unknown;
    };
    const s = Number(obj.score);
    const reasonText = readReasonText(obj.reasonText, obj.reasons);
    const suggestedFix = typeof obj.suggestedFix === 'string' ? obj.suggestedFix : '';
    return {
      score: Number.isFinite(s) ? s : 1,
      reasonText,
      suggestedFix,
    };
  } catch {
    return { score: 1, reasonText: '', suggestedFix: '' };
  }
}

function readReasonText(reasonText: unknown, reasons: unknown): string {
  if (typeof reasonText === 'string') return reasonText;
  if (Array.isArray(reasons)) {
    const joined = reasons
      .filter((r): r is string => typeof r === 'string')
      .join('; ');
    return joined;
  }
  return '';
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 1;
  return Math.max(0, Math.min(1, x));
}
