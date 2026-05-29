/**
 * M-2 surface 2 tests — eviction-notice LLM drafter.
 *
 * Covers:
 *   1. Happy path — LLM returns valid bilingual JSON with citations.
 *   2. Cache control — ephemeral marker present + draft NEVER auto-sends.
 *   3. Fail-fallback — LLM errors -> heuristic template wins.
 *   4. Heuristic direct invocation with jurisdiction-specific checkpoints.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  createLlmEvictionNoticeDrafter,
  defaultHeuristicEvictionNotice,
  type EvictionNoticeInput,
} from '../eviction-notice-llm.js';
import type { BrainLlmClient } from '../../brain/llm-call.js';

const BASE_INPUT: EvictionNoticeInput = {
  tenantName: 'Asha Mwanga',
  leaseId: 'lease-42',
  propertyAddress: '12 Bibi Titi Mohamed Rd, Dar es Salaam',
  amountMinor: 1_200_000_00,
  currency: 'TZS',
  daysOverdue: 47,
  breachKind: 'arrears',
  breachSummary: 'Three consecutive monthly rent payments missed.',
  jurisdiction: 'TZ',
  locale: 'sw-TZ',
  ownerSignatureBlock: 'Owner: John Mwikila',
  factIds: ['ledger-2026-04-01', 'ledger-2026-05-01'],
};

function buildFakeClient(
  response: unknown,
  capture: { request: unknown | null },
): BrainLlmClient {
  return Object.freeze({
    model: 'claude-sonnet-4-6',
    sdk: {
      messages: {
        async create(request: unknown): Promise<{
          content: Array<{ type: string; text?: string }>;
          usage?: Record<string, number>;
        }> {
          capture.request = request;
          return {
            content: [{ type: 'text', text: JSON.stringify(response) }],
            usage: { input_tokens: 120, output_tokens: 250 },
          };
        },
      },
    },
  });
}

describe('eviction-notice-llm (M-2 surface 2)', () => {
  it('happy path — bilingual JSON parses + draftStatus stays queued-for-owner-review', async () => {
    const capture: { request: unknown | null } = { request: null };
    const client = buildFakeClient(
      {
        subjectSw: 'Taarifa rasmi: lipa au ondoka',
        subjectEn: 'Formal notice: pay or quit',
        bodyMarkdownSw: 'Kwa Asha Mwanga,\n\nHii ni rasimu. Mali: 12 Bibi Titi. Deni: 1200000 TZS. Ushahidi: ledger-2026-04-01.',
        bodyMarkdownEn: 'Dear Asha Mwanga,\n\nDraft notice. Property: 12 Bibi Titi. Balance: 1200000 TZS. Evidence: ledger-2026-04-01.',
        mandatoryReviewCheckpoints: ['Verify Land (LLTA) Act 2022 §56 window'],
        citedFactIds: ['ledger-2026-04-01', 'ledger-2026-05-01'],
      },
      capture,
    );
    const drafter = createLlmEvictionNoticeDrafter({ client });
    const out = await drafter(BASE_INPUT);
    expect(out.draftStatus).toBe('queued-for-owner-review');
    expect(out.llmProvider).toBe('anthropic');
    expect(out.citedFactIds).toContain('ledger-2026-04-01');
    expect(out.bodyMarkdownSw).toContain('Asha Mwanga');
    expect(out.bodyMarkdownEn).toContain('Asha Mwanga');
    expect(out.nextStepGuidance).toMatch(/does NOT file/);
  });

  it('cache_control — system block carries ephemeral marker', async () => {
    const capture: { request: unknown | null } = { request: null };
    const client = buildFakeClient(
      {
        subjectSw: 'Taarifa rasmi',
        subjectEn: 'Formal notice',
        bodyMarkdownSw: 'Kwa mteja. Rasimu yenye ushahidi ledger-2026-04-01.',
        bodyMarkdownEn: 'Dear tenant. Draft with evidence ledger-2026-04-01.',
        mandatoryReviewCheckpoints: ['verify amount'],
        citedFactIds: ['ledger-2026-04-01'],
      },
      capture,
    );
    const drafter = createLlmEvictionNoticeDrafter({ client });
    await drafter(BASE_INPUT);
    const req = capture.request as {
      system: Array<{ type: string; text: string; cache_control?: { type: string } }>;
    };
    expect(req.system[0]?.cache_control?.type).toBe('ephemeral');
    expect(req.system[0]?.text).toContain('NEVER files');
  });

  it('fail-fallback — LLM throws -> heuristic returns bilingual draft', async () => {
    const client: BrainLlmClient = Object.freeze({
      model: 'claude-sonnet-4-6',
      sdk: {
        messages: {
          async create(): Promise<never> {
            throw new Error('upstream 500');
          },
        },
      },
    });
    const logger = { warn: vi.fn(), error: vi.fn() };
    const drafter = createLlmEvictionNoticeDrafter({
      client,
      logger: logger as never,
    });
    const out = await drafter(BASE_INPUT);
    expect(out.llmProvider).toBe('heuristic');
    expect(out.bodyMarkdownSw).toContain('Asha Mwanga');
    expect(out.bodyMarkdownEn).toContain('Asha Mwanga');
    expect(out.citedFactIds).toEqual(['ledger-2026-04-01', 'ledger-2026-05-01']);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('heuristic — TZ jurisdiction adds LLTA Act 2022 §56 checkpoint', async () => {
    const out = await defaultHeuristicEvictionNotice(BASE_INPUT);
    expect(out.draftStatus).toBe('queued-for-owner-review');
    expect(out.mandatoryReviewCheckpoints.some((c) => c.includes('LLTA 2022'))).toBe(false);
    expect(out.mandatoryReviewCheckpoints.some((c) => c.includes('§56'))).toBe(true);
  });
});
