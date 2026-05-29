/**
 * M-2 surface 2 — Eviction-notice LLM drafter (BossNyumba launch closure).
 *
 * Wraps the deterministic notice template (analogous to
 * `packages/central-intelligence/src/kernel/sub-mds/arrears-chaser/tools/draft-notice.ts`)
 * with a real Anthropic LLM call that produces a bilingual Swahili+English
 * legal-style draft grounded in the supplied facts, breach kind, and
 * jurisdiction.
 *
 * Mirrors Borjie's R15 inspection-narrator pattern (G-FIX-2).
 *
 * Hard contract:
 *   - The output is STILL a draft. The tool MUST NOT file or send.
 *   - The narrative must cite every fact_id supplied (mandatory review
 *     checkpoints) — empty evidence array drops to the heuristic.
 *   - Locale gates pick the right statute references (KE / TZ / UG / NG).
 *
 * Per CLAUDE.md:
 *   - Bilingual sw/en (default sw).
 *   - Pino logger only.
 *   - Money via formatCurrency (handled by caller).
 *   - Brain MAY NEVER hand-roll legal copy without a vetted template
 *     prefix — system prompt enforces this.
 */

import type { Logger } from 'pino';
import { z } from 'zod';

import {
  callBrainLlmJson,
  withLlmOrHeuristic,
  type BrainLlmClient,
} from '../brain/llm-call';

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export type EvictionBreachKind =
  | 'arrears'
  | 'damage'
  | 'unauthorised-occupants'
  | 'illegal-use'
  | 'nuisance'
  | 'other';

export type EvictionLocale = 'sw-TZ' | 'en-TZ' | 'sw-KE' | 'en-KE' | 'en-UG' | 'en-NG';

export interface EvictionNoticeInput {
  readonly tenantName: string;
  readonly leaseId: string;
  readonly propertyAddress: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly daysOverdue: number;
  readonly breachKind: EvictionBreachKind;
  readonly breachSummary: string;
  readonly jurisdiction: 'TZ' | 'KE' | 'UG' | 'NG';
  readonly locale: EvictionLocale;
  readonly ownerSignatureBlock: string;
  /** Fact identifiers the drafter must cite (lease, ledger entry, etc). */
  readonly factIds: ReadonlyArray<string>;
}

export interface EvictionNoticeDraft {
  readonly draftStatus: 'queued-for-owner-review';
  readonly subjectSw: string;
  readonly subjectEn: string;
  readonly bodyMarkdownSw: string;
  readonly bodyMarkdownEn: string;
  readonly mandatoryReviewCheckpoints: ReadonlyArray<string>;
  readonly citedFactIds: ReadonlyArray<string>;
  readonly nextStepGuidance: string;
  readonly llmProvider: 'anthropic' | 'heuristic';
  readonly llmModel: string | null;
}

const DRAFT_SCHEMA = z.object({
  subjectSw: z.string().min(5),
  subjectEn: z.string().min(5),
  bodyMarkdownSw: z.string().min(80),
  bodyMarkdownEn: z.string().min(80),
  mandatoryReviewCheckpoints: z.array(z.string()).min(1),
  citedFactIds: z.array(z.string()).default([]),
});

const PROMPT_VERSION = 'm2-eviction-notice-v1';

const SYSTEM_PROMPT = [
  'You are Mr. Mwikila, BossNyumba\'s bilingual (Swahili/English)',
  'AI Managing Director. Your job here is to DRAFT a non-binding',
  'eviction / arrears notice for the landlord to review and sign.',
  '',
  'IMPORTANT BLAST-RADIUS NOTE:',
  '- This tool DRAFTS. It NEVER files, sends, or otherwise executes',
  '  an eviction. The landlord must explicitly escalate to the HQ-tier',
  '  platform.evict_tenant tool to dispatch the actual workflow.',
  '- The draft is reversible (delete row) and ships with',
  '  draftStatus="queued-for-owner-review".',
  '',
  'Hard rules (do not break):',
  '- Output JSON ONLY matching:',
  '  { "subjectSw": <Swahili subject>, "subjectEn": <English subject>,',
  '    "bodyMarkdownSw": <Swahili Markdown body>,',
  '    "bodyMarkdownEn": <English Markdown body>,',
  '    "mandatoryReviewCheckpoints": [<string>, ...],',
  '    "citedFactIds": [<string>, ...] }',
  '- BOTH narratives are required. Swahili is the default user language.',
  '- The body MUST cite every fact_id supplied in a "## Ushahidi" /',
  '  "## Evidence" section. citedFactIds mirrors what you cite.',
  '- Include the statutory minimum notice for the jurisdiction (TZ Land',
  '  Act 1999 §83 / Land (Landlord and Tenant) Act 2022 §56; KE Distress',
  '  for Rent Act + L&T Act Cap. 301 §4; UG Landlord & Tenant Act 2022;',
  '  NG Recovery of Premises Act + Lagos State Tenancy Law 2011).',
  '- Use neutral, factual prose. No marketing copy. No emojis.',
  '- mandatoryReviewCheckpoints lists what the owner must verify before',
  '  signing (tenant name, amount, days overdue, statutory window, etc).',
  '- Keep each narrative under ~3 000 characters.',
].join('\n');

export type DraftEvictionNotice = (
  input: EvictionNoticeInput,
) => Promise<EvictionNoticeDraft>;

export interface EvictionNoticeLlmOptions {
  readonly client: BrainLlmClient;
  readonly logger?: Logger | undefined;
  readonly heuristic?: DraftEvictionNotice | undefined;
  readonly model?: string | undefined;
}

// ---------------------------------------------------------------------------
// Heuristic — deterministic template, always available
// ---------------------------------------------------------------------------

const HEURISTIC_CHECKPOINTS_BY_JURISDICTION: Readonly<Record<EvictionNoticeInput['jurisdiction'], ReadonlyArray<string>>> = Object.freeze({
  TZ: Object.freeze([
    'Confirm Land (Landlord and Tenant) Act 2022 §56 90-day window.',
    'Verify TRA TIN disclosed on lease.',
  ]),
  KE: Object.freeze([
    'Confirm Distress for Rent Act minimum 7-day notice for distress.',
    'Confirm L&T Act Cap. 301 §4 60-day quit window.',
  ]),
  UG: Object.freeze([
    'Confirm Landlord & Tenant Act 2022 30-day arrears window.',
    'Verify URSB registration of landlord disclosed on lease.',
  ]),
  NG: Object.freeze([
    'Confirm Recovery of Premises Act yearly-tenancy 6-month notice.',
    'Confirm Lagos State Tenancy Law 2011 §13 + §16 7-day pre-suit notice.',
  ]),
});

export async function defaultHeuristicEvictionNotice(
  input: EvictionNoticeInput,
): Promise<EvictionNoticeDraft> {
  const major = (input.amountMinor / 100).toFixed(0);
  const isSw = input.locale.startsWith('sw-');

  const subjectSw =
    input.breachKind === 'arrears'
      ? 'Taarifa rasmi: lipa au ondoka'
      : 'Taarifa rasmi ya makosa ya mkataba';
  const subjectEn =
    input.breachKind === 'arrears'
      ? 'Formal notice: pay or quit'
      : 'Formal notice of lease breach';

  const factsSection = input.factIds.length > 0
    ? `\n\n## ${isSw ? 'Ushahidi' : 'Evidence'}\n${input.factIds.map((id) => `- ${id}`).join('\n')}`
    : '';

  const bodySw = [
    `Kwa ${input.tenantName},`,
    '',
    'Hii ni taarifa rasmi ya rasimu (kwa marejeleo ya mmiliki kabla ya kusainiwa).',
    `Mali: ${input.propertyAddress}`,
    `Mkataba: ${input.leaseId}`,
    input.breachKind === 'arrears'
      ? `Deni: ${input.currency} ${major}\nKuchelewa: siku ${input.daysOverdue}`
      : `Aina ya makosa: ${input.breachKind}\nMaelezo: ${input.breachSummary}`,
    '',
    'Tafadhali wasiliana na ofisi yetu kupanga malipo au kurekebisha makosa.',
    '',
    input.ownerSignatureBlock,
    factsSection,
  ].join('\n');

  const bodyEn = [
    `Dear ${input.tenantName},`,
    '',
    'This is a DRAFT notice prepared for owner review and signature.',
    `Property: ${input.propertyAddress}`,
    `Lease: ${input.leaseId}`,
    input.breachKind === 'arrears'
      ? `Outstanding balance: ${input.currency} ${major}\nDays overdue: ${input.daysOverdue}`
      : `Breach kind: ${input.breachKind}\nDetails: ${input.breachSummary}`,
    '',
    'Please contact our office to arrange payment or remedy the breach.',
    '',
    input.ownerSignatureBlock,
    factsSection,
  ].join('\n');

  const baseCheckpoints = [
    'verify tenant name and lease id against latest record',
    'confirm amount matches latest invoice + agreed fees',
    'confirm days-overdue from books reconciled within 24h',
    'check no partial payment posted since classifier run',
    'verify owner is the named landlord on the lease',
  ];

  return {
    draftStatus: 'queued-for-owner-review',
    subjectSw,
    subjectEn,
    bodyMarkdownSw: bodySw,
    bodyMarkdownEn: bodyEn,
    mandatoryReviewCheckpoints: [
      ...baseCheckpoints,
      ...HEURISTIC_CHECKPOINTS_BY_JURISDICTION[input.jurisdiction],
    ],
    citedFactIds: input.factIds,
    nextStepGuidance:
      'Owner must review for accuracy, sign, and (if proceeding) route through the HQ-tier eviction/filing tool. This drafter does NOT file.',
    llmProvider: 'heuristic',
    llmModel: null,
  };
}

// ---------------------------------------------------------------------------
// LLM-backed drafter
// ---------------------------------------------------------------------------

export function createLlmEvictionNoticeDrafter(
  options: EvictionNoticeLlmOptions,
): DraftEvictionNotice {
  const heuristic = options.heuristic ?? defaultHeuristicEvictionNotice;

  return async (input: EvictionNoticeInput): Promise<EvictionNoticeDraft> => {
    return withLlmOrHeuristic<EvictionNoticeDraft>({
      pathName: 'eviction-notice-m2-s2',
      logger: options.logger,
      heuristic: () => heuristic(input),
      hasEvidence: (out) => {
        if (input.factIds.length === 0) return true;
        return out.citedFactIds.length > 0;
      },
      llmAttempt: async () => {
        const result = await callBrainLlmJson({
          client: options.client,
          ...(options.model !== undefined ? { model: options.model } : {}),
          system: SYSTEM_PROMPT,
          user: buildUserPrompt(input),
          schema: DRAFT_SCHEMA,
          maxTokens: 3500,
          temperature: 0.3,
          ...(options.logger !== undefined ? { logger: options.logger } : {}),
        });
        return {
          draftStatus: 'queued-for-owner-review',
          subjectSw: result.data.subjectSw,
          subjectEn: result.data.subjectEn,
          bodyMarkdownSw: result.data.bodyMarkdownSw,
          bodyMarkdownEn: result.data.bodyMarkdownEn,
          mandatoryReviewCheckpoints: result.data.mandatoryReviewCheckpoints,
          citedFactIds: result.data.citedFactIds,
          nextStepGuidance:
            'Owner must review for accuracy, sign, and (if proceeding) route through the HQ-tier eviction/filing tool. This drafter does NOT file.',
          llmProvider: 'anthropic',
          llmModel: result.model,
        };
      },
    });
  };
}

function buildUserPrompt(input: EvictionNoticeInput): string {
  return JSON.stringify(
    {
      promptVersion: PROMPT_VERSION,
      tenantName: input.tenantName,
      leaseId: input.leaseId,
      propertyAddress: input.propertyAddress,
      amountMinor: input.amountMinor,
      currency: input.currency,
      daysOverdue: input.daysOverdue,
      breachKind: input.breachKind,
      breachSummary: input.breachSummary,
      jurisdiction: input.jurisdiction,
      locale: input.locale,
      ownerSignatureBlock: input.ownerSignatureBlock,
      factIds: input.factIds,
    },
    null,
    2,
  );
}
