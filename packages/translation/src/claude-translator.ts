/**
 * Claude translator port — wraps @anthropic-ai/sdk.
 *
 * Uses claude-sonnet-4-5-20250929 at temperature 0 (deterministic).
 * Domain hint: BossNyumba — Tanzanian residential & commercial real
 * estate property management. Tanzanian Swahili variant rule applied
 * (formal-ish, second-person -wewe / mwenye, "mwathirika wa kodi"
 * for "rent-burdened tenant", etc.).
 *
 * The Claude SDK is injected so unit tests pass a stub without
 * touching the network.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { ClaudeTranslatorPort, Locale, Register } from './types.js';
import { assertNoContamination } from './contamination.js';

export const BN_CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';

export interface ClaudeTranslatorConfig {
  readonly model?: string;
  readonly maxTokens?: number;
  /** When true, throw ContaminationError on cross-language leak. */
  readonly enforceContamination?: boolean;
}

export interface ClaudeTranslatorDeps {
  readonly client: Anthropic;
  readonly config?: ClaudeTranslatorConfig;
}

function languageName(lang: Locale): string {
  return lang === 'sw' ? 'Tanzanian Swahili' : 'English';
}

function registerHint(register: Register): string {
  switch (register) {
    case 'formal':
      return 'Use a formal register (Bwana / Bibi / Mheshimiwa where appropriate). Honorific second-person.';
    case 'casual':
      return 'Use a friendly conversational register suitable for tenant chat. Second-person "wewe".';
    case 'neutral':
    default:
      return 'Use a neutral, professional register. Second-person "wewe" unless a title is more natural.';
  }
}

function buildSystemPrompt(input: {
  readonly sourceLang: Locale;
  readonly targetLang: Locale;
  readonly register: Register;
  readonly surface: string;
}): string {
  const src = languageName(input.sourceLang);
  const tgt = languageName(input.targetLang);
  return [
    `You are a professional translator for BossNyumba, a Tanzanian residential and commercial real-estate property-management platform.`,
    `Translate the user's text from ${src} to ${tgt}.`,
    `${registerHint(input.register)}`,
    `Domain glossary hints — preserve verbatim: "BossNyumba", "M-Pesa", "TRA", "BRELA", "Pango" (lease), "Mpangaji" (tenant), "Mwenye nyumba" (landlord), "Wakala" (agent), "Karadha" (deposit).`,
    `Tanzanian Swahili variant rule: use Tanzanian Bantu vocabulary — NOT Kenyan or Congolese variants. Prefer "asante" over "shukrani", "samahani" over "msamaha".`,
    `Surface: ${input.surface}. Keep the same line breaks and punctuation. Preserve any HTML/markdown unchanged.`,
    `Reply with ONLY the translation. No preface, no quotes, no explanation.`,
  ].join('\n');
}

export function createClaudeTranslator(deps: ClaudeTranslatorDeps): ClaudeTranslatorPort {
  const model = deps.config?.model ?? BN_CLAUDE_MODEL;
  const maxTokens = deps.config?.maxTokens ?? 4096;
  const enforceContamination = deps.config?.enforceContamination ?? false;

  return Object.freeze({
    async translate(input) {
      const response = await deps.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature: 0,
        system: buildSystemPrompt(input),
        messages: [
          {
            role: 'user',
            content: input.text,
          },
        ],
      });

      // Extract first text block. Anthropic SDK returns content as
      // an array of blocks; we expect a single text block at temp 0.
      const block = response.content.find((b) => b.type === 'text');
      if (block === undefined || block.type !== 'text') {
        throw new Error('claude translator: empty response');
      }
      const text = block.text.trim();
      if (text.length === 0) {
        throw new Error('claude translator: blank translation');
      }

      if (enforceContamination) {
        assertNoContamination(text, input.targetLang);
      }

      return text;
    },
  });
}
