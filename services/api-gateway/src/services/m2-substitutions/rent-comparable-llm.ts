/**
 * M-2 surface 1 — Rent-comparable LLM advisor (BossNyumba launch closure).
 *
 * Wraps the existing market-surveillance adapter chain with a real
 * Anthropic LLM call that turns raw `ComparableListing[]` data into a
 * bilingual Swahili+English narrative + recommended rent band grounded
 * in the comparables.
 *
 * Mirrors Borjie's R16 negotiation-counter pattern (G-FIX-2). The LLM
 * is called only when ANTHROPIC_API_KEY is set; otherwise the
 * heuristic clamp (median of provided comparables) is returned.
 *
 * Per CLAUDE.md:
 *   - Bilingual sw/en (default sw).
 *   - Evidence-required wrapper — output without ≥1 cited adapterId is
 *     rejected and the heuristic is used as fallback.
 *   - Pino logger only.
 *   - Money via formatCurrency (handled by caller — this helper returns
 *     numeric rentMonthlyMinorUnits, not formatted strings).
 */

import type { Logger } from 'pino';
import { z } from 'zod';

import {
  callBrainLlmJson,
  withLlmOrHeuristic,
  type BrainLlmClient,
} from '../brain/llm-call';

// ---------------------------------------------------------------------------
// Input / output contracts (deliberately decoupled from the database
// `ComparableListing` shape so the heuristic + LLM can be tested in
// isolation without a Drizzle dependency)
// ---------------------------------------------------------------------------

export interface RentComparableInput {
  readonly unitId: string;
  readonly tenantTimezone: string;
  readonly currency: string;
  readonly bedrooms: number | null;
  readonly squareMeters: number | null;
  /** Optional anchor — current rent the owner is collecting. */
  readonly currentRentMinorUnits: number | null;
  readonly comparables: ReadonlyArray<{
    readonly adapterId: string;
    readonly url: string | null;
    readonly title: string;
    readonly rawDescription: string;
    readonly latitude: number | null;
    readonly longitude: number | null;
  }>;
}

export interface RentComparableRecommendation {
  readonly recommendedRentMinorUnits: number;
  readonly lowBandMinorUnits: number;
  readonly highBandMinorUnits: number;
  readonly currency: string;
  readonly narrativeSw: string;
  readonly narrativeEn: string;
  /** Comparable adapterIds the recommendation cites. Non-empty = evidence. */
  readonly evidenceAdapterIds: ReadonlyArray<string>;
  readonly llmProvider: 'anthropic' | 'heuristic';
  readonly llmModel: string | null;
}

const RECOMMENDATION_SCHEMA = z.object({
  recommendedRentMinorUnits: z.number().int().min(0).max(1_000_000_00),
  lowBandMinorUnits: z.number().int().min(0).max(1_000_000_00),
  highBandMinorUnits: z.number().int().min(0).max(1_000_000_00),
  narrativeSw: z.string().min(40),
  narrativeEn: z.string().min(40),
  evidenceAdapterIds: z.array(z.string()).default([]),
});

const PROMPT_VERSION = 'm2-rent-comparable-v1';

const SYSTEM_PROMPT = [
  'You are Mr. Mwikila, the bilingual (Swahili/English) AI Managing',
  'Director for BossNyumba — a Tanzanian (and pan-African) property-',
  'management OS. Your job here is to read a list of comparable',
  'rental listings for a single unit and recommend a fair monthly',
  'rent band that the landlord can use as the starting point for a',
  'lease negotiation.',
  '',
  'Hard rules (do not break):',
  '- Output JSON ONLY matching:',
  '  { "recommendedRentMinorUnits": <int>,',
  '    "lowBandMinorUnits": <int>, "highBandMinorUnits": <int>,',
  '    "narrativeSw": <Swahili Markdown>, "narrativeEn": <English Markdown>,',
  '    "evidenceAdapterIds": [<string>, ...] }',
  '- Minor units are integer; currency assumed from caller context.',
  '- Bands MUST satisfy lowBandMinorUnits <= recommendedRentMinorUnits <= highBandMinorUnits.',
  '- The narrative MUST cite the comparable adapterIds you used (e.g.',
  '  rentometer, airbnb, zillow) in a "## Ushahidi" / "## Evidence"',
  '  section. evidenceAdapterIds mirrors the IDs you cite.',
  '- If the caller supplied zero comparables you MUST still return an',
  '  empty evidenceAdapterIds array AND set the bands to currentRent',
  '  +/- 5% (or zero when currentRent is null) so the downstream',
  '  Auditor Agent can flag the missing-evidence path.',
  '- Use neutral, factual prose. No marketing copy. No emojis.',
  '- Keep each narrative under ~2 500 characters.',
].join('\n');

export type GenerateRentComparableRecommendation = (
  input: RentComparableInput,
) => Promise<RentComparableRecommendation>;

export interface RentComparableLlmOptions {
  readonly client: BrainLlmClient;
  readonly logger?: Logger | undefined;
  readonly heuristic?: GenerateRentComparableRecommendation | undefined;
  readonly model?: string | undefined;
}

// ---------------------------------------------------------------------------
// Heuristic — deterministic median-of-comparables clamp. Always available.
// ---------------------------------------------------------------------------

const HEURISTIC_BAND_PCT = 7;

export async function defaultHeuristicRentComparable(
  input: RentComparableInput,
): Promise<RentComparableRecommendation> {
  const numericFromDescription = (text: string): number | null => {
    // eslint-disable-next-line security/detect-unsafe-regex -- reason: mandatory separator between digit groups prevents backtracking; alternation is ordered so longer form matches first; applied to trusted LLM description text
    const match = text.match(/(\d{1,3}(?:[,_ ]\d{3})+|\d+)/);
    if (!match) return null;
    const cleaned = match[1]!.replace(/[,_ ]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  const rents = input.comparables
    .map((c) => numericFromDescription(c.rawDescription))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  if (rents.length === 0) {
    const anchor = input.currentRentMinorUnits ?? 0;
    return {
      recommendedRentMinorUnits: anchor,
      lowBandMinorUnits: Math.max(0, Math.round(anchor * 0.95)),
      highBandMinorUnits: Math.round(anchor * 1.05),
      currency: input.currency,
      narrativeSw: 'Hakuna ulinganifu wa rasimu uliopatikana. Mapendekezo yamejengwa kwenye thamani ya sasa ya kodi.',
      narrativeEn: 'No comparable listings available. Recommendation derived from the current rent anchor.',
      evidenceAdapterIds: [],
      llmProvider: 'heuristic',
      llmModel: null,
    };
  }

  const mid = rents.length === 1 ? rents[0]! : rents[Math.floor(rents.length / 2)]!;
  const lo = Math.round(mid * (1 - HEURISTIC_BAND_PCT / 100));
  const hi = Math.round(mid * (1 + HEURISTIC_BAND_PCT / 100));
  const adapterIds = input.comparables.map((c) => c.adapterId);

  return {
    recommendedRentMinorUnits: mid,
    lowBandMinorUnits: lo,
    highBandMinorUnits: hi,
    currency: input.currency,
    narrativeSw: `Mapendekezo ya kodi yameongozwa na ulinganifu ${rents.length} kutoka kwa ${adapterIds.join(', ')}. Kati: ${mid}. Bendi: ${lo}-${hi}.`,
    narrativeEn: `Recommendation derived from ${rents.length} comparable listings (sources: ${adapterIds.join(', ')}). Median: ${mid}. Band: ${lo}-${hi}.`,
    evidenceAdapterIds: adapterIds,
    llmProvider: 'heuristic',
    llmModel: null,
  };
}

// ---------------------------------------------------------------------------
// LLM-backed advisor with graceful heuristic fallback
// ---------------------------------------------------------------------------

export function createLlmRentComparableAdvisor(
  options: RentComparableLlmOptions,
): GenerateRentComparableRecommendation {
  const heuristic = options.heuristic ?? defaultHeuristicRentComparable;

  return async (input: RentComparableInput): Promise<RentComparableRecommendation> => {
    return withLlmOrHeuristic<RentComparableRecommendation>({
      pathName: 'rent-comparable-m2-s1',
      logger: options.logger,
      heuristic: () => heuristic(input),
      hasEvidence: (out) => {
        // If the caller supplied comparables, the LLM output MUST cite at
        // least one adapterId — empty arrays drop us to the heuristic.
        if (input.comparables.length === 0) return true;
        return out.evidenceAdapterIds.length > 0;
      },
      llmAttempt: async () => {
        const result = await callBrainLlmJson({
          client: options.client,
          ...(options.model !== undefined ? { model: options.model } : {}),
          system: SYSTEM_PROMPT,
          user: buildUserPrompt(input),
          schema: RECOMMENDATION_SCHEMA,
          maxTokens: 2500,
          temperature: 0.3,
          ...(options.logger !== undefined ? { logger: options.logger } : {}),
        });
        return {
          recommendedRentMinorUnits: result.data.recommendedRentMinorUnits,
          lowBandMinorUnits: result.data.lowBandMinorUnits,
          highBandMinorUnits: result.data.highBandMinorUnits,
          currency: input.currency,
          narrativeSw: result.data.narrativeSw,
          narrativeEn: result.data.narrativeEn,
          evidenceAdapterIds: result.data.evidenceAdapterIds,
          llmProvider: 'anthropic',
          llmModel: result.model,
        };
      },
    });
  };
}

function buildUserPrompt(input: RentComparableInput): string {
  return JSON.stringify(
    {
      promptVersion: PROMPT_VERSION,
      unitId: input.unitId,
      tenantTimezone: input.tenantTimezone,
      currency: input.currency,
      bedrooms: input.bedrooms,
      squareMeters: input.squareMeters,
      currentRentMinorUnits: input.currentRentMinorUnits,
      comparables: input.comparables.map((c) => ({
        adapterId: c.adapterId,
        url: c.url,
        title: c.title,
        rawDescription: c.rawDescription,
        latitude: c.latitude,
        longitude: c.longitude,
      })),
    },
    null,
    2,
  );
}
