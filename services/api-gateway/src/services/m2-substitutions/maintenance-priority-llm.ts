/**
 * M-2 surface 3 — Maintenance-priority LLM scorer (BossNyumba launch closure).
 *
 * Replaces a deterministic clamp (keyword-based severity) with a real
 * Anthropic LLM call that reads a maintenance request narrative + any
 * supplied photo URLs and produces a structured priority assessment:
 *
 *   { category, severity, urgency, priorityScore (1..100), ... }
 *
 * Mirrors Borjie's R17 RAG-citation-parser pattern (G-FIX-2). The LLM
 * cites each photo URL it references — empty citations on a request
 * that supplied photos drops to the heuristic.
 *
 * The existing OpenAI-powered MaintenanceTriageService in
 * `packages/ai-copilot/src/services/maintenance-triage.ts` remains
 * available; this surface is a separate Anthropic-on-Claude path
 * activated by ANTHROPIC_API_KEY. The two coexist intentionally — the
 * heuristic clamp is the ground floor; either AI path can be wired in
 * by composition without changing the request-handler contract.
 *
 * Per CLAUDE.md:
 *   - Bilingual sw/en (default sw).
 *   - Pino logger only.
 *   - Evidence-required wrapper (photo URLs cited when supplied).
 */

import type { Logger } from 'pino';
import { z } from 'zod';

import {
  callBrainLlmJson,
  withLlmOrHeuristic,
  type BrainLlmClient,
} from '../brain/llm-call';

export type MaintenanceCategory =
  | 'PLUMBING'
  | 'ELECTRICAL'
  | 'HVAC'
  | 'APPLIANCE'
  | 'STRUCTURAL'
  | 'PEST_CONTROL'
  | 'SAFETY'
  | 'EXTERIOR'
  | 'COMMON_AREA'
  | 'COSMETIC'
  | 'ROOFING'
  | 'FLOORING'
  | 'LOCKS_SECURITY'
  | 'OTHER';

export type MaintenanceSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type MaintenanceUrgency = 'EMERGENCY' | 'URGENT' | 'HIGH' | 'STANDARD' | 'LOW';

export interface MaintenancePriorityInput {
  readonly requestId: string;
  readonly description: string;
  readonly photoUrls: ReadonlyArray<string>;
  readonly hints: ReadonlyArray<string>;
  readonly propertyType: 'residential' | 'commercial' | 'mixed';
  readonly hasMinors: boolean;
  readonly hasMedicalDependent: boolean;
}

export interface MaintenancePriorityAssessment {
  readonly category: MaintenanceCategory;
  readonly severity: MaintenanceSeverity;
  readonly urgency: MaintenanceUrgency;
  readonly priorityScore: number;
  readonly safetyConcerns: ReadonlyArray<string>;
  readonly suggestedActionsSw: ReadonlyArray<string>;
  readonly suggestedActionsEn: ReadonlyArray<string>;
  readonly citedPhotoUrls: ReadonlyArray<string>;
  readonly llmProvider: 'anthropic' | 'heuristic';
  readonly llmModel: string | null;
}

const ASSESSMENT_SCHEMA = z.object({
  category: z.enum([
    'PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE', 'STRUCTURAL',
    'PEST_CONTROL', 'SAFETY', 'EXTERIOR', 'COMMON_AREA', 'COSMETIC',
    'ROOFING', 'FLOORING', 'LOCKS_SECURITY', 'OTHER',
  ]),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  urgency: z.enum(['EMERGENCY', 'URGENT', 'HIGH', 'STANDARD', 'LOW']),
  priorityScore: z.number().int().min(1).max(100),
  safetyConcerns: z.array(z.string()),
  suggestedActionsSw: z.array(z.string()).min(1),
  suggestedActionsEn: z.array(z.string()).min(1),
  citedPhotoUrls: z.array(z.string()).default([]),
});

const PROMPT_VERSION = 'm2-maintenance-priority-v1';

const SYSTEM_PROMPT = [
  'You are Mr. Mwikila, BossNyumba\'s bilingual (Swahili/English) AI',
  'Managing Director. Your job here is to TRIAGE a maintenance request',
  'and produce a structured priority assessment that a property',
  'manager can act on within minutes.',
  '',
  'Hard rules (do not break):',
  '- Output JSON ONLY matching the schema (category, severity, urgency,',
  '  priorityScore, safetyConcerns, suggestedActionsSw, suggestedActionsEn,',
  '  citedPhotoUrls).',
  '- priorityScore is an integer 1..100 (higher = sooner). EMERGENCY +',
  '  CRITICAL safety scenarios MUST land in [90, 100]. LOW cosmetic',
  '  defects MUST land in [1, 25].',
  '- If photos were supplied, citedPhotoUrls MUST list every URL you',
  '  actually used to ground your assessment. Empty array when no',
  '  photos were supplied.',
  '- Escalate one notch when hasMinors or hasMedicalDependent is true',
  '  and the issue affects habitability (water, gas, electricity,',
  '  safety hazards).',
  '- suggestedActions: 3-7 short imperatives in EACH language.',
  '- No marketing copy. No emojis.',
].join('\n');

export type AssessMaintenancePriority = (
  input: MaintenancePriorityInput,
) => Promise<MaintenancePriorityAssessment>;

export interface MaintenancePriorityLlmOptions {
  readonly client: BrainLlmClient;
  readonly logger?: Logger | undefined;
  readonly heuristic?: AssessMaintenancePriority | undefined;
  readonly model?: string | undefined;
}

const SAFETY_KEYWORDS = ['gas', 'fire', 'smoke', 'electric shock', 'flooding', 'sewage', 'no water', 'no power', 'roof collapse'];
const PLUMBING_KEYWORDS = ['leak', 'pipe', 'drain', 'toilet', 'water'];
const ELECTRICAL_KEYWORDS = ['power', 'electric', 'breaker', 'outlet', 'wiring'];
const STRUCTURAL_KEYWORDS = ['wall', 'ceiling', 'crack', 'collapse', 'foundation'];
const COSMETIC_KEYWORDS = ['paint', 'scratch', 'chip', 'discolour', 'discolor'];

function pickCategory(text: string): MaintenanceCategory {
  const lower = text.toLowerCase();
  if (PLUMBING_KEYWORDS.some((k) => lower.includes(k))) return 'PLUMBING';
  if (ELECTRICAL_KEYWORDS.some((k) => lower.includes(k))) return 'ELECTRICAL';
  if (STRUCTURAL_KEYWORDS.some((k) => lower.includes(k))) return 'STRUCTURAL';
  if (COSMETIC_KEYWORDS.some((k) => lower.includes(k))) return 'COSMETIC';
  return 'OTHER';
}

export async function defaultHeuristicMaintenancePriority(
  input: MaintenancePriorityInput,
): Promise<MaintenancePriorityAssessment> {
  const lower = `${input.description} ${input.hints.join(' ')}`.toLowerCase();
  const hasSafetyKw = SAFETY_KEYWORDS.some((k) => lower.includes(k));
  const isCosmetic = COSMETIC_KEYWORDS.some((k) => lower.includes(k));
  const vulnerable = input.hasMinors || input.hasMedicalDependent;

  const category = pickCategory(`${input.description} ${input.hints.join(' ')}`);

  let severity: MaintenanceSeverity = 'MEDIUM';
  let urgency: MaintenanceUrgency = 'STANDARD';
  let priorityScore = 50;

  if (hasSafetyKw) {
    severity = vulnerable ? 'CRITICAL' : 'HIGH';
    urgency = vulnerable ? 'EMERGENCY' : 'URGENT';
    priorityScore = vulnerable ? 95 : 85;
  } else if (isCosmetic) {
    severity = 'LOW';
    urgency = 'LOW';
    priorityScore = 15;
  } else if (vulnerable) {
    severity = 'HIGH';
    urgency = 'HIGH';
    priorityScore = 70;
  }

  const safetyConcerns = hasSafetyKw
    ? [`Possible safety hazard inferred from keywords (${category.toLowerCase()}).`]
    : [];

  const baseActions: { sw: string[]; en: string[] } = {
    sw: [
      'Wasiliana na fundi aliyepatikana karibu.',
      'Hakikisha eneo ni salama kabla ya ukaguzi.',
      'Andika picha za hali ya sasa.',
    ],
    en: [
      'Dispatch nearest available technician.',
      'Confirm site is safe before inspection.',
      'Document current condition with photos.',
    ],
  };
  if (vulnerable) {
    baseActions.sw.push('Hakikisha familia inajulishwa kuhusu mpangilio wa kazi.');
    baseActions.en.push('Confirm tenant is briefed on scheduling.');
  }

  return {
    category,
    severity,
    urgency,
    priorityScore,
    safetyConcerns,
    suggestedActionsSw: baseActions.sw,
    suggestedActionsEn: baseActions.en,
    citedPhotoUrls: input.photoUrls,
    llmProvider: 'heuristic',
    llmModel: null,
  };
}

export function createLlmMaintenancePriorityScorer(
  options: MaintenancePriorityLlmOptions,
): AssessMaintenancePriority {
  const heuristic = options.heuristic ?? defaultHeuristicMaintenancePriority;

  return async (input: MaintenancePriorityInput): Promise<MaintenancePriorityAssessment> => {
    return withLlmOrHeuristic<MaintenancePriorityAssessment>({
      pathName: 'maintenance-priority-m2-s3',
      logger: options.logger,
      heuristic: () => heuristic(input),
      hasEvidence: (out) => {
        if (input.photoUrls.length === 0) return true;
        return out.citedPhotoUrls.length > 0;
      },
      llmAttempt: async () => {
        const result = await callBrainLlmJson({
          client: options.client,
          ...(options.model !== undefined ? { model: options.model } : {}),
          system: SYSTEM_PROMPT,
          user: buildUserPrompt(input),
          schema: ASSESSMENT_SCHEMA,
          maxTokens: 1500,
          temperature: 0.2,
          ...(options.logger !== undefined ? { logger: options.logger } : {}),
        });
        return {
          category: result.data.category,
          severity: result.data.severity,
          urgency: result.data.urgency,
          priorityScore: result.data.priorityScore,
          safetyConcerns: result.data.safetyConcerns,
          suggestedActionsSw: result.data.suggestedActionsSw,
          suggestedActionsEn: result.data.suggestedActionsEn,
          citedPhotoUrls: result.data.citedPhotoUrls,
          llmProvider: 'anthropic',
          llmModel: result.model,
        };
      },
    });
  };
}

function buildUserPrompt(input: MaintenancePriorityInput): string {
  return JSON.stringify(
    {
      promptVersion: PROMPT_VERSION,
      requestId: input.requestId,
      description: input.description,
      photoUrls: input.photoUrls,
      hints: input.hints,
      propertyType: input.propertyType,
      hasMinors: input.hasMinors,
      hasMedicalDependent: input.hasMedicalDependent,
    },
    null,
    2,
  );
}
