/**
 * Independent answerer unit tests.
 */

import { describe, expect, it } from 'vitest';
import {
  llmAnswerer,
  evidenceAnswerer,
  chainAnswerers,
} from '../independent-answerer.js';
import type { LlmClient } from '../../ports/llm-client.js';
import type { FactualClaim } from '../../types.js';

const claim: FactualClaim = {
  id: 'c_1',
  factClass: 'amount',
  text: 'KES 100',
};

describe('llmAnswerer', () => {
  it('parses answer text + Confidence: line', async () => {
    const mockLlm: LlmClient = {
      messages: {
        async create() {
          return {
            content: [
              { type: 'text', text: 'The rent is KES 100.\nConfidence: 0.87' },
            ],
          };
        },
      },
    };
    const answerer = llmAnswerer({ llm: mockLlm, model: 'haiku' });
    const ans = await answerer.answer(claim, 'What is the rent?');
    expect(ans.confidence).toBeCloseTo(0.87, 2);
    expect(ans.source).toBe('llm');
    expect(ans.answer).toContain('KES 100');
  });

  it('returns zero confidence on "I do not know"', async () => {
    const mockLlm: LlmClient = {
      messages: {
        async create() {
          return {
            content: [{ type: 'text', text: 'I do not know.\nConfidence: 0.0' }],
          };
        },
      },
    };
    const answerer = llmAnswerer({ llm: mockLlm, model: 'haiku' });
    const ans = await answerer.answer(claim, 'q');
    expect(ans.confidence).toBe(0);
  });

  it('returns no-data on LLM error', async () => {
    const mockLlm: LlmClient = {
      messages: {
        async create() {
          throw new Error('network');
        },
      },
    };
    const answerer = llmAnswerer({ llm: mockLlm, model: 'haiku' });
    const ans = await answerer.answer(claim, 'q');
    expect(ans.source).toBe('no-data');
    expect(ans.confidence).toBe(0);
  });
});

describe('evidenceAnswerer', () => {
  it('returns lookup hit', async () => {
    const answerer = evidenceAnswerer({
      lookup: () => ({ answer: 'KES 100 confirmed', confidence: 0.9 }),
    });
    const ans = await answerer.answer(claim, 'q');
    expect(ans.source).toBe('evidence');
    expect(ans.confidence).toBe(0.9);
  });

  it('returns no-data on lookup miss', async () => {
    const answerer = evidenceAnswerer({ lookup: () => null });
    const ans = await answerer.answer(claim, 'q');
    expect(ans.source).toBe('no-data');
    expect(ans.confidence).toBe(0);
  });
});

describe('chainAnswerers', () => {
  it('picks the highest-confidence answer', async () => {
    const lowConf = evidenceAnswerer({
      lookup: () => ({ answer: 'low', confidence: 0.3 }),
    });
    const highConf = evidenceAnswerer({
      lookup: () => ({ answer: 'high', confidence: 0.9 }),
    });
    const ans = await chainAnswerers(lowConf, highConf).answer(claim, 'q');
    expect(ans.answer).toBe('high');
  });

  it('falls back to no-data when all answerers return no-data', async () => {
    const a = evidenceAnswerer({ lookup: () => null });
    const ans = await chainAnswerers(a, a).answer(claim, 'q');
    expect(ans.source).toBe('no-data');
  });
});
