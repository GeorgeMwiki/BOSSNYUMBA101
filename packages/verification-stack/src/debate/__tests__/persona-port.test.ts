/**
 * Persona port unit tests — covers the LLM-backed persona path.
 */

import { describe, expect, it } from 'vitest';
import { llmPersona, heuristicPersona } from '../persona-port.js';
import { configFor } from '../personas.js';
import type { LlmClient } from '../../ports/llm-client.js';

describe('llmPersona', () => {
  it('parses a structured JSON response', async () => {
    const llm: LlmClient = {
      messages: {
        async create() {
          return {
            content: [
              {
                type: 'text',
                text:
                  'Considering the law,\n{"position":"Notice missing.","recommendation":"block","confidence":0.9}\nDone.',
              },
            ],
          };
        },
      },
    };
    const p = llmPersona({ llm, model: 'sonnet' });
    const pos = await p.produce('Legal', {
      round: 1,
      actionClass: 'eviction',
      actionDescription: 'test',
      context: {},
    });
    expect(pos.recommendation).toBe('block');
    expect(pos.confidence).toBeCloseTo(0.9, 2);
    expect(pos.persona).toBe('Legal');
  });

  it('uses default lean on LLM error', async () => {
    const llm: LlmClient = {
      messages: {
        async create() {
          throw new Error('boom');
        },
      },
    };
    const p = llmPersona({ llm, model: 'sonnet' });
    const pos = await p.produce('Legal', {
      round: 1,
      actionClass: 'eviction',
      actionDescription: 'test',
      context: {},
    });
    expect(pos.recommendation).toBe('block'); // Legal default lean
  });

  it('uses default lean on unparseable response', async () => {
    const llm: LlmClient = {
      messages: {
        async create() {
          return { content: [{ type: 'text', text: 'no JSON here' }] };
        },
      },
    };
    const p = llmPersona({ llm, model: 'sonnet' });
    const pos = await p.produce('Financial', {
      round: 1,
      actionClass: 'eviction',
      actionDescription: 'test',
      context: {},
    });
    expect(pos.recommendation).toBe('proceed'); // Financial default lean
  });

  it('passes previousRound positions in round 2', async () => {
    let userMsg = '';
    const llm: LlmClient = {
      messages: {
        async create(req) {
          userMsg = req.messages[0]!.content;
          return {
            content: [
              {
                type: 'text',
                text:
                  '{"position":"reconsidered","recommendation":"modify","confidence":0.8}',
              },
            ],
          };
        },
      },
    };
    const p = llmPersona({ llm, model: 'sonnet' });
    await p.produce('PropertyManager', {
      round: 2,
      actionClass: 'eviction',
      actionDescription: 'test',
      context: {},
      previousRound: [
        {
          persona: 'Legal',
          round: 1,
          position: 'block this.',
          recommendation: 'block',
          confidence: 0.9,
        },
      ],
    });
    expect(userMsg).toMatch(/Round 1 positions/);
    expect(userMsg).toMatch(/Legal.*block/);
  });
});

describe('heuristicPersona round-2 rebuttal', () => {
  it('adjusts confidence up when others agree', async () => {
    const p = heuristicPersona();
    const round1 = await p.produce('Legal', {
      round: 1,
      actionClass: 'eviction',
      actionDescription: 'test',
      context: {
        no_statutory_notice: true,
        hardship_request_open: false,
        recovery_probability: 0.3,
        operational_burden: 'low',
      },
    });
    const round2 = await p.produce('Legal', {
      round: 2,
      actionClass: 'eviction',
      actionDescription: 'test',
      context: {
        no_statutory_notice: true,
        hardship_request_open: false,
        recovery_probability: 0.3,
        operational_burden: 'low',
      },
      previousRound: [
        {
          persona: 'Legal',
          round: 1,
          position: 'block',
          recommendation: 'block',
          confidence: 0.95,
        },
        {
          persona: 'Empathy',
          round: 1,
          position: 'block',
          recommendation: 'block',
          confidence: 0.8,
        },
        {
          persona: 'Financial',
          round: 1,
          position: 'block',
          recommendation: 'block',
          confidence: 0.7,
        },
        {
          persona: 'PropertyManager',
          round: 1,
          position: 'esc',
          recommendation: 'escalate',
          confidence: 0.85,
        },
      ],
    });
    expect(round2.confidence).toBeGreaterThanOrEqual(round1.confidence);
  });
});

describe('configFor', () => {
  it('returns each persona config', () => {
    expect(configFor('Legal').defaultLean).toBe('block');
    expect(configFor('Empathy').defaultLean).toBe('modify');
    expect(configFor('Financial').defaultLean).toBe('proceed');
    expect(configFor('PropertyManager').defaultLean).toBe('escalate');
  });

  it('throws on unknown persona', () => {
    expect(() => configFor('Unknown' as never)).toThrow();
  });
});
