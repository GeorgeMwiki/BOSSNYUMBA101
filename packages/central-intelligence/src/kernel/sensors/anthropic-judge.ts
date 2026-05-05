/**
 * Anthropic Haiku judge — LLM-as-judge for high-stakes decisions.
 *
 * Mirrors LITFIN's self-review judge pass. The kernel passes the
 * sensor's draft answer to the judge, which returns a numeric score
 * in [0,1] indicating how well the answer satisfies the question
 * with citations and clarity. The kernel uses this score in the
 * confidence vector's `review` component.
 *
 * Pure adapter; the kernel itself stays provider-agnostic.
 */

import type { AnthropicMessagesClient } from './anthropic-sensor.js';

export interface AnthropicJudgeConfig {
  readonly modelId?: string;
  readonly maxTokens?: number;
}

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You are a quality judge for property-management AI answers. You read a draft answer and return a single JSON object: {"score": NUMBER, "reasons": [STRING]}.

The score is in [0, 1]:
  1.0 — every factual claim is grounded; tone matches a property-ops voice; no fabrication.
  0.7 — mostly grounded; some uncited claims, but no hallucination.
  0.4 — partial grounding; reasonable structure; at least one clear hedge missing.
  0.0 — fabrications, off-topic, or refuses without justification.

Return ONLY the JSON object. No markdown. No commentary.`;

export function createAnthropicJudge(
  client: AnthropicMessagesClient,
  config: AnthropicJudgeConfig = {},
): (text: string) => Promise<{ score: number }> {
  const modelId = config.modelId ?? DEFAULT_MODEL;
  const maxTokens = config.maxTokens ?? 256;

  return async function judge(text: string): Promise<{ score: number }> {
    if (!text.trim()) return { score: 0 };
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
      return { score: clamp01(parsed.score) };
    } catch {
      // A judge failure must not break the main turn; fall back to
      // the neutral 1.0 (kernel uses min(...components), so 1.0 means
      // "judge did not constrain confidence").
      return { score: 1 };
    }
  };
}

function parseJudgeResponse(body: string): { score: number } {
  const match = body.match(/\{[\s\S]*?\}/);
  if (!match) return { score: 1 };
  try {
    const obj = JSON.parse(match[0]) as { score?: unknown };
    const s = Number(obj.score);
    return { score: Number.isFinite(s) ? s : 1 };
  } catch {
    return { score: 1 };
  }
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 1;
  return Math.max(0, Math.min(1, x));
}
