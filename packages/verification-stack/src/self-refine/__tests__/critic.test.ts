/**
 * Self-Refine critic unit tests.
 */

import { describe, expect, it } from 'vitest';
import { heuristicCritic, llmCritic } from '../critic.js';
import type { LlmClient } from '../../ports/llm-client.js';

describe('heuristicCritic', () => {
  it('penalises aggressive tone tokens', async () => {
    const critic = heuristicCritic();
    const c = await critic.critique({
      iteration: 1,
      draft: 'PAY OR ELSE! You have failed, idiot.',
      originalContext: 'test',
      actionClass: 'rent-reminder',
    });
    expect(c.toneScore).toBeLessThan(0.6);
    expect(c.accepted).toBe(false);
  });

  it('rewards factual precision', async () => {
    const critic = heuristicCritic();
    const c = await critic.critique({
      iteration: 1,
      draft:
        'Mr John Otieno, your rent of KES 50,000 due on 1 May 2026 remains unpaid.',
      originalContext: 'test',
      actionClass: 'rent-reminder',
    });
    expect(c.factualPrecisionScore).toBeGreaterThan(0.7);
  });

  it('penalises wrong jurisdiction', async () => {
    const critic = heuristicCritic();
    const c = await critic.critique({
      iteration: 1,
      draft: 'Per the Kenya Rent Restriction Tribunal, eviction proceeds.',
      originalContext: 'test',
      actionClass: 'eviction-warning',
      tenantJurisdiction: 'TZ-DSM',
    });
    expect(c.jurisdictionAppropriatenessScore).toBeLessThan(0.5);
  });

  it('penalises legal jargon', async () => {
    const critic = heuristicCritic();
    const c = await critic.critique({
      iteration: 1,
      draft: 'Whereas the lease shall hereinafter be renewed pursuant to clause 4.',
      originalContext: 'test',
      actionClass: 'lease-renewal-offer',
    });
    expect(c.clarityScore).toBeLessThan(0.6);
  });

  it('penalises excessive length', async () => {
    const critic = heuristicCritic();
    const veryLong = Array.from({ length: 20 }, () => 'This is a sentence.').join(' ');
    const c = await critic.critique({
      iteration: 1,
      draft: veryLong,
      originalContext: 'test',
      actionClass: 'complaint-response',
    });
    expect(c.lengthScore).toBeLessThan(0.5);
  });
});

describe('llmCritic', () => {
  it('parses JSON response', async () => {
    const mockLlm: LlmClient = {
      messages: {
        async create() {
          return {
            content: [
              {
                type: 'text',
                text: '{"tone":0.9,"factualPrecision":0.8,"jurisdictionAppropriateness":0.95,"clarity":0.85,"length":1,"feedback":"ok"}',
              },
            ],
          };
        },
      },
    };
    const critic = llmCritic({ llm: mockLlm });
    const c = await critic.critique({
      iteration: 1,
      draft: 'whatever',
      originalContext: 'test',
      actionClass: 'rent-reminder',
    });
    expect(c.toneScore).toBeCloseTo(0.9, 2);
    expect(c.accepted).toBe(true);
  });

  it('falls back to heuristic on LLM error', async () => {
    const mockLlm: LlmClient = {
      messages: {
        async create() {
          throw new Error('boom');
        },
      },
    };
    const critic = llmCritic({ llm: mockLlm });
    const c = await critic.critique({
      iteration: 1,
      draft: 'Pay rent.',
      originalContext: 'test',
      actionClass: 'rent-reminder',
    });
    expect(typeof c.toneScore).toBe('number');
  });
});
