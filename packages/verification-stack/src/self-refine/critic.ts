/**
 * Self-Refine critic — scores a tenant-facing message draft on:
 *
 *   - tone                          (firm-but-respectful, no aggression)
 *   - factual-precision             (specific amounts, dates, names)
 *   - jurisdiction-appropriateness  (TZ tenancy law assumptions only when relevant)
 *   - clarity                       (single message, no jargon)
 *   - length                        (≤ 220 words; ≤ 6 sentences for SMS)
 *
 * Each dimension is scored 0..1; `overall` is the equal-weight mean.
 * `accepted = overall >= 0.75 AND every dimension >= 0.55`. The
 * acceptance threshold is intentionally strict — Self-Refine pushes
 * for ~20% gains in 3 iterations (Madaan 2023, arxiv 2303.17651).
 *
 * Two implementations:
 *   - LLM-backed (preferred — Haiku 4.5)
 *   - heuristic (tests + offline replay; identical interface)
 */

import { extractText, type LlmClient } from '../ports/llm-client.js';
import type { SelfRefineCritique } from '../types.js';

export interface CriticInput {
  readonly iteration: number;
  readonly draft: string;
  readonly originalContext: string;
  readonly actionClass: string;
  readonly tenantJurisdiction?: string;
}

export interface CriticPort {
  critique(input: CriticInput): Promise<SelfRefineCritique>;
}

const DEFAULT_MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = [
  'You are the BOSSNYUMBA Self-Refine Critic.',
  'Score the draft tenant-facing message across these dimensions, each 0..1:',
  '  1. tone: firm-but-respectful, no threats, no aggression, no condescension.',
  '  2. factual-precision: amounts, dates, party names are specific and correct.',
  '  3. jurisdiction-appropriateness: any legal references match the tenant jurisdiction.',
  '  4. clarity: single message, no jargon, clear next step.',
  '  5. length: ≤ 220 words and ≤ 6 sentences (SMS-friendly).',
  '',
  'Output strict JSON:',
  '{"tone":0..1,"factualPrecision":0..1,"jurisdictionAppropriateness":0..1,"clarity":0..1,"length":0..1,"feedback":"one sentence"}',
].join('\n');

export interface LlmCriticArgs {
  readonly llm: LlmClient;
  readonly model?: string;
  readonly maxTokens?: number;
}

export function llmCritic(args: LlmCriticArgs): CriticPort {
  const model = args.model ?? DEFAULT_MODEL;
  const maxTokens = args.maxTokens ?? 384;
  return {
    async critique(input): Promise<SelfRefineCritique> {
      const userPrompt = [
        `Iteration: ${input.iteration}`,
        `Action class: ${input.actionClass}`,
        `Tenant jurisdiction: ${input.tenantJurisdiction ?? 'unknown'}`,
        `Original context: ${input.originalContext}`,
        '',
        'Draft:',
        input.draft,
      ].join('\n');

      try {
        const resp = await args.llm.messages.create({
          model,
          max_tokens: maxTokens,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        });
        const text = extractText(resp);
        return parseCritiqueResponse(text, input.iteration);
      } catch {
        return heuristicCritique(input);
      }
    },
  };
}

/**
 * Heuristic critic — deterministic, no LLM. Used by tests + as a
 * graceful fallback when the LLM is unavailable.
 *
 * Scoring rules:
 *   - tone: penalises threat tokens, ALL-CAPS, excessive exclamation.
 *   - factual-precision: rewards presence of currency+amount+date+name.
 *   - jurisdiction-appropriateness: penalises citing non-TZ law when
 *     jurisdiction is TZ.
 *   - clarity: penalises jargon ("hereinafter", "pursuant to").
 *   - length: penalises > 220 words OR > 6 sentences.
 */
export function heuristicCritic(): CriticPort {
  return {
    async critique(input): Promise<SelfRefineCritique> {
      return heuristicCritique(input);
    },
  };
}

function heuristicCritique(input: CriticInput): SelfRefineCritique {
  const draft = input.draft;
  const tone = scoreTone(draft);
  const factualPrecision = scoreFactualPrecision(draft);
  const jurisdictionAppropriateness = scoreJurisdiction(
    draft,
    input.tenantJurisdiction,
  );
  const clarity = scoreClarity(draft);
  const length = scoreLength(draft);

  const overall =
    (tone + factualPrecision + jurisdictionAppropriateness + clarity + length) /
    5;

  const minDimension = Math.min(
    tone,
    factualPrecision,
    jurisdictionAppropriateness,
    clarity,
    length,
  );
  const accepted = overall >= 0.75 && minDimension >= 0.55;

  return {
    iteration: input.iteration,
    toneScore: tone,
    factualPrecisionScore: factualPrecision,
    jurisdictionAppropriatenessScore: jurisdictionAppropriateness,
    clarityScore: clarity,
    lengthScore: length,
    overall,
    accepted,
    feedback: buildFeedback({
      tone,
      factualPrecision,
      jurisdictionAppropriateness,
      clarity,
      length,
    }),
  };
}

function scoreTone(draft: string): number {
  let score = 1;
  const lower = draft.toLowerCase();
  const aggressive = [
    'pay or else',
    'we will sue',
    'idiot',
    'criminal',
    'shameful',
    'disgraceful',
    'you have failed',
  ];
  for (const phrase of aggressive) {
    if (lower.includes(phrase)) score -= 0.25;
  }
  const exclamationCount = (draft.match(/!/g) ?? []).length;
  if (exclamationCount > 2) score -= 0.15 * (exclamationCount - 2);
  // ALL CAPS bands of 4+ chars
  const capsBands = (draft.match(/\b[A-Z]{4,}\b/g) ?? []).length;
  if (capsBands > 0) score -= 0.1 * capsBands;
  return clamp01(score);
}

function scoreFactualPrecision(draft: string): number {
  let score = 0.4;
  if (/\b(?:KES|TZS|USD|TSh|UGX)\s*[\d,]+/i.test(draft)) score += 0.2;
  if (/\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(draft)) {
    score += 0.2;
  } else if (/\b\d{4}-\d{2}-\d{2}\b/.test(draft)) {
    score += 0.2;
  }
  if (/\b(?:Mr|Mrs|Ms|Dr|tenant|landlord)\s+[A-Z][a-z]+/.test(draft)) {
    score += 0.2;
  }
  return clamp01(score);
}

function scoreJurisdiction(draft: string, jurisdiction?: string): number {
  if (!jurisdiction) return 0.8;
  const lower = draft.toLowerCase();
  const isTZ = jurisdiction.toUpperCase().startsWith('TZ');
  const isKE = jurisdiction.toUpperCase().startsWith('KE');
  if (isTZ && /\b(?:kenya|rent restriction tribunal|hud|eu ai act)\b/.test(lower)) {
    return 0.3;
  }
  if (isKE && /\b(?:land act|housing tribunal of tanzania)\b/.test(lower)) {
    return 0.3;
  }
  return 0.95;
}

function scoreClarity(draft: string): number {
  let score = 1;
  const jargon = [
    'hereinafter',
    'pursuant to',
    'whereas',
    'in accordance with the aforesaid',
    'notwithstanding',
  ];
  const lower = draft.toLowerCase();
  for (const j of jargon) {
    if (lower.includes(j)) score -= 0.2;
  }
  if (draft.split(/[.!?]/).length > 10) score -= 0.1;
  return clamp01(score);
}

function scoreLength(draft: string): number {
  const words = draft.split(/\s+/).filter((w) => w.length > 0).length;
  const sentences = draft.split(/[.!?]/).filter((s) => s.trim().length > 0).length;
  if (words <= 220 && sentences <= 6) return 1;
  if (words <= 300 && sentences <= 8) return 0.7;
  if (words <= 400 && sentences <= 12) return 0.4;
  return 0.2;
}

function buildFeedback(scores: {
  tone: number;
  factualPrecision: number;
  jurisdictionAppropriateness: number;
  clarity: number;
  length: number;
}): string {
  const parts: string[] = [];
  if (scores.tone < 0.7) parts.push('Soften tone (remove threats/exclamations).');
  if (scores.factualPrecision < 0.7) parts.push('Add specific amount, date, and party name.');
  if (scores.jurisdictionAppropriateness < 0.7) {
    parts.push('Cite the tenant-jurisdiction statute, not another country\'s law.');
  }
  if (scores.clarity < 0.7) parts.push('Remove legal jargon; one clear next step.');
  if (scores.length < 0.7) parts.push('Tighten to ≤ 220 words and ≤ 6 sentences.');
  return parts.length === 0 ? 'Draft meets all dimensions.' : parts.join(' ');
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function parseCritiqueResponse(
  raw: string,
  iteration: number,
): SelfRefineCritique {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    // Could not parse — return all-zero so caller treats as reject.
    return {
      iteration,
      toneScore: 0,
      factualPrecisionScore: 0,
      jurisdictionAppropriatenessScore: 0,
      clarityScore: 0,
      lengthScore: 0,
      overall: 0,
      accepted: false,
      feedback: 'Critic response unparseable.',
    };
  }
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const tone = clamp01(Number(obj.tone));
    const fact = clamp01(Number(obj.factualPrecision));
    const juris = clamp01(Number(obj.jurisdictionAppropriateness));
    const clar = clamp01(Number(obj.clarity));
    const len = clamp01(Number(obj.length));
    const overall = (tone + fact + juris + clar + len) / 5;
    const min = Math.min(tone, fact, juris, clar, len);
    const accepted = overall >= 0.75 && min >= 0.55;
    return {
      iteration,
      toneScore: tone,
      factualPrecisionScore: fact,
      jurisdictionAppropriatenessScore: juris,
      clarityScore: clar,
      lengthScore: len,
      overall,
      accepted,
      feedback: String(obj.feedback ?? '').slice(0, 500),
    };
  } catch {
    return {
      iteration,
      toneScore: 0,
      factualPrecisionScore: 0,
      jurisdictionAppropriatenessScore: 0,
      clarityScore: 0,
      lengthScore: 0,
      overall: 0,
      accepted: false,
      feedback: 'Critic JSON parse failed.',
    };
  }
}
