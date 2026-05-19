/**
 * Sampler port — produces N independent estimates of a numeric value.
 *
 * Two implementations:
 *   - LLM-backed sampler: calls the LLM N times at T=0.7 and parses
 *     a number out of each completion.
 *   - Function-backed sampler: wraps a pure function (rare — used for
 *     formulas like proration that we want to verify match a reference
 *     algorithm). Each "sample" perturbs the inputs slightly to test
 *     stability.
 */

import { extractText, type LlmClient } from '../ports/llm-client.js';

export interface NumericPromptInput {
  readonly prompt: string;
  /** Arbitrary context for the LLM. */
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface SamplerPort {
  sample(input: NumericPromptInput): Promise<number>;
}

export interface LlmSamplerArgs {
  readonly llm: LlmClient;
  readonly model: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

const NUMBER_RX = /-?\d+(?:[.,]\d+)*/;

export function llmSampler(args: LlmSamplerArgs): SamplerPort {
  const maxTokens = args.maxTokens ?? 128;
  const temperature = args.temperature ?? 0.7;
  return {
    async sample(input): Promise<number> {
      const userPrompt = [
        input.prompt,
        '',
        'Respond with ONLY the final numeric value (no units, no commentary).',
      ].join('\n');
      try {
        const resp = await args.llm.messages.create({
          model: args.model,
          max_tokens: maxTokens,
          temperature,
          system:
            'You are a numeric computation engine. Show no work; emit only the final number.',
          messages: [{ role: 'user', content: userPrompt }],
        });
        const text = extractText(resp).trim();
        const m = NUMBER_RX.exec(text);
        if (!m) return Number.NaN;
        return parseFloat(m[0].replace(/,/g, ''));
      } catch {
        return Number.NaN;
      }
    },
  };
}

/**
 * Function-backed sampler. The function is called N times; each call
 * may produce a slightly different result if the function has its
 * own randomness. We do NOT perturb inputs — the sampler is meant
 * for testing reference algorithms.
 */
export function functionSampler(
  fn: (input: NumericPromptInput) => number | Promise<number>,
): SamplerPort {
  return {
    async sample(input): Promise<number> {
      return Promise.resolve(fn(input));
    },
  };
}
