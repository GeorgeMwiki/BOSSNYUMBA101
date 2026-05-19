/**
 * Self-Refine refiner unit tests.
 */

import { describe, expect, it } from 'vitest';
import { heuristicRefiner, llmRefiner } from '../refiner.js';
import type { LlmClient } from '../../ports/llm-client.js';

const baseCritique = {
  iteration: 1,
  toneScore: 1,
  factualPrecisionScore: 1,
  jurisdictionAppropriatenessScore: 1,
  clarityScore: 1,
  lengthScore: 1,
  overall: 1,
  accepted: true,
  feedback: '',
};

describe('heuristicRefiner', () => {
  it('softens aggressive language when tone is low', async () => {
    const refiner = heuristicRefiner();
    const out = await refiner.refine({
      draft: 'Pay or else, idiot!',
      critique: { ...baseCritique, toneScore: 0.3, accepted: false },
      actionClass: 'rent-reminder',
      originalContext: 'test',
    });
    expect(out).not.toMatch(/idiot/i);
    expect(out).not.toMatch(/pay or else/i);
  });

  it('removes legal jargon when clarity is low', async () => {
    const refiner = heuristicRefiner();
    const out = await refiner.refine({
      draft: 'Whereas the lease shall hereinafter be renewed pursuant to clause 4.',
      critique: { ...baseCritique, clarityScore: 0.3, accepted: false },
      actionClass: 'lease-renewal-offer',
      originalContext: 'test',
    });
    expect(out).not.toMatch(/hereinafter/i);
    expect(out).not.toMatch(/whereas/i);
    expect(out).not.toMatch(/pursuant to/i);
  });

  it('trims to 6 sentences when length is low', async () => {
    const refiner = heuristicRefiner();
    const longDraft = Array.from({ length: 12 }, () => 'A sentence.').join(' ');
    const out = await refiner.refine({
      draft: longDraft,
      critique: { ...baseCritique, lengthScore: 0.3, accepted: false },
      actionClass: 'complaint-response',
      originalContext: 'test',
    });
    const sentences = out.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
    expect(sentences.length).toBeLessThanOrEqual(6);
  });

  it('scrubs foreign jurisdiction citations', async () => {
    const refiner = heuristicRefiner();
    const out = await refiner.refine({
      draft: 'Per the Kenya Rent Restriction Tribunal, eviction proceeds.',
      critique: {
        ...baseCritique,
        jurisdictionAppropriatenessScore: 0.3,
        accepted: false,
      },
      actionClass: 'eviction-warning',
      originalContext: 'test',
      tenantJurisdiction: 'TZ-DSM',
    });
    expect(out).toMatch(/REMOVED/);
  });

  it('adds factual placeholders when precision is low', async () => {
    const refiner = heuristicRefiner();
    const out = await refiner.refine({
      draft: 'Please pay your rent.',
      critique: {
        ...baseCritique,
        factualPrecisionScore: 0.3,
        accepted: false,
      },
      actionClass: 'rent-reminder',
      originalContext: 'test',
    });
    expect(out).toMatch(/\[AMOUNT\]|\[DATE\]/);
  });
});

describe('llmRefiner', () => {
  it('returns LLM text', async () => {
    const mockLlm: LlmClient = {
      messages: {
        async create() {
          return { content: [{ type: 'text', text: 'Better draft.' }] };
        },
      },
    };
    const refiner = llmRefiner({ llm: mockLlm });
    const out = await refiner.refine({
      draft: 'old',
      critique: { ...baseCritique, accepted: false },
      actionClass: 'rent-reminder',
      originalContext: 'test',
    });
    expect(out).toBe('Better draft.');
  });

  it('falls back to heuristic on LLM error', async () => {
    const mockLlm: LlmClient = {
      messages: {
        async create() {
          throw new Error('boom');
        },
      },
    };
    const refiner = llmRefiner({ llm: mockLlm });
    const out = await refiner.refine({
      draft: 'PAY OR ELSE',
      critique: { ...baseCritique, toneScore: 0.2, accepted: false },
      actionClass: 'rent-reminder',
      originalContext: 'test',
    });
    expect(typeof out).toBe('string');
    expect(out).not.toMatch(/pay or else/i);
  });
});
