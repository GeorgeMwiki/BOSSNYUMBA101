/**
 * Refiner — takes a draft + a critic verdict and returns an improved
 * draft. Two implementations:
 *
 *   - LLM-backed Refiner (preferred)
 *   - heuristic Refiner — applies deterministic edits keyed on the
 *     dimensions the critic flagged. Used by tests + offline.
 */

import { extractText, type LlmClient } from '../ports/llm-client.js';
import type { SelfRefineCritique } from '../types.js';

export interface RefinerInput {
  readonly draft: string;
  readonly critique: SelfRefineCritique;
  readonly actionClass: string;
  readonly originalContext: string;
  readonly tenantJurisdiction?: string;
}

export interface RefinerPort {
  refine(input: RefinerInput): Promise<string>;
}

export interface LlmRefinerArgs {
  readonly llm: LlmClient;
  readonly model?: string;
  readonly maxTokens?: number;
}

const DEFAULT_MODEL = 'claude-sonnet-4-6';

export function llmRefiner(args: LlmRefinerArgs): RefinerPort {
  const model = args.model ?? DEFAULT_MODEL;
  const maxTokens = args.maxTokens ?? 768;
  return {
    async refine(input): Promise<string> {
      const userPrompt = [
        `Action class: ${input.actionClass}`,
        `Tenant jurisdiction: ${input.tenantJurisdiction ?? 'unknown'}`,
        `Original context: ${input.originalContext}`,
        '',
        'Critic feedback:',
        input.critique.feedback,
        `Scores — tone=${input.critique.toneScore.toFixed(2)}, ` +
          `factual=${input.critique.factualPrecisionScore.toFixed(2)}, ` +
          `jurisdiction=${input.critique.jurisdictionAppropriatenessScore.toFixed(2)}, ` +
          `clarity=${input.critique.clarityScore.toFixed(2)}, ` +
          `length=${input.critique.lengthScore.toFixed(2)}`,
        '',
        'Current draft:',
        input.draft,
        '',
        'Rewrite the message to address the critique while preserving the action class\'s intent. Output ONLY the rewritten message.',
      ].join('\n');

      try {
        const resp = await args.llm.messages.create({
          model,
          max_tokens: maxTokens,
          system:
            'You are the BOSSNYUMBA tenant-comms refiner. Rewrite drafts to score 1.0 on every Self-Refine critic dimension.',
          messages: [{ role: 'user', content: userPrompt }],
        });
        return extractText(resp).trim() || input.draft;
      } catch {
        return heuristicRefine(input);
      }
    },
  };
}

export function heuristicRefiner(): RefinerPort {
  return {
    async refine(input): Promise<string> {
      return heuristicRefine(input);
    },
  };
}

/**
 * Deterministic refiner — applies a series of textual edits keyed on
 * which dimension scored low. Each edit is a small, safe transformation
 * that the critic's heuristic would in turn re-score higher.
 */
function heuristicRefine(input: RefinerInput): string {
  let draft = input.draft;
  const c = input.critique;

  if (c.toneScore < 0.7) {
    draft = softenTone(draft);
  }
  if (c.clarityScore < 0.7) {
    draft = removeJargon(draft);
  }
  if (c.lengthScore < 0.7) {
    draft = shorten(draft);
  }
  if (c.factualPrecisionScore < 0.7) {
    draft = addFactualPlaceholders(draft);
  }
  if (c.jurisdictionAppropriatenessScore < 0.7) {
    draft = scrubForeignJurisdiction(draft, input.tenantJurisdiction);
  }
  return draft;
}

function softenTone(draft: string): string {
  return draft
    .replace(/pay or else/gi, 'kindly arrange payment')
    .replace(/we will sue/gi, 'we may need to escalate per the lease terms')
    .replace(/idiot/gi, '')
    .replace(/criminal/gi, '')
    .replace(/shameful/gi, '')
    .replace(/disgraceful/gi, '')
    .replace(/you have failed/gi, 'we have not yet received')
    .replace(/!{2,}/g, '.')
    .replace(/\b([A-Z]{4,})\b/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());
}

function removeJargon(draft: string): string {
  return draft
    .replace(/hereinafter/gi, 'below')
    .replace(/pursuant to/gi, 'under')
    .replace(/whereas/gi, 'since')
    .replace(/in accordance with the aforesaid/gi, 'as agreed')
    .replace(/notwithstanding/gi, 'despite');
}

function shorten(draft: string): string {
  // Keep first 6 sentences.
  const sentences = draft.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  if (sentences.length <= 6) return draft;
  return sentences.slice(0, 6).join(' ');
}

function addFactualPlaceholders(draft: string): string {
  let out = draft;
  if (!/\b(?:KES|TZS|USD|TSh|UGX)\s*[\d,]+/i.test(out) && !/\[AMOUNT\]/.test(out)) {
    out = `${out} (amount: [AMOUNT])`;
  }
  if (!/\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(out) &&
      !/\b\d{4}-\d{2}-\d{2}\b/.test(out) &&
      !/\[DATE\]/.test(out)) {
    out = `${out} (date: [DATE])`;
  }
  return out;
}

function scrubForeignJurisdiction(draft: string, jurisdiction?: string): string {
  if (!jurisdiction) return draft;
  const isTZ = jurisdiction.toUpperCase().startsWith('TZ');
  const isKE = jurisdiction.toUpperCase().startsWith('KE');
  let out = draft;
  if (isTZ) {
    out = out.replace(/\bKenya\b/g, '[REMOVED:foreign-juris]');
    out = out.replace(/\bRent Restriction Tribunal\b/gi, '[REMOVED:foreign-juris]');
    out = out.replace(/\bHUD\b/g, '[REMOVED:foreign-juris]');
    out = out.replace(/\bEU AI Act\b/gi, '[REMOVED:foreign-juris]');
  }
  if (isKE) {
    out = out.replace(/\bLand Act\b/g, '[REMOVED:foreign-juris]');
    out = out.replace(/\bHousing Tribunal of Tanzania\b/gi, '[REMOVED:foreign-juris]');
  }
  return out;
}
