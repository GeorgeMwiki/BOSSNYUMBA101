/**
 * Sampler unit tests — covers the LLM-backed sampler path.
 */

import { describe, expect, it } from 'vitest';
import { llmSampler, functionSampler } from '../sampler.js';
import type { LlmClient } from '../../ports/llm-client.js';

describe('llmSampler', () => {
  it('parses a clean numeric response', async () => {
    const llm: LlmClient = {
      messages: {
        async create() {
          return { content: [{ type: 'text', text: '2500' }] };
        },
      },
    };
    const s = llmSampler({ llm, model: 'sonnet', temperature: 0.7 });
    const v = await s.sample({ prompt: 'late fee?' });
    expect(v).toBe(2500);
  });

  it('parses thousands-separator commas', async () => {
    const llm: LlmClient = {
      messages: {
        async create() {
          return { content: [{ type: 'text', text: '12,345' }] };
        },
      },
    };
    const s = llmSampler({ llm, model: 'sonnet' });
    const v = await s.sample({ prompt: 'amount?' });
    expect(v).toBe(12345);
  });

  it('returns NaN on non-numeric response', async () => {
    const llm: LlmClient = {
      messages: {
        async create() {
          return { content: [{ type: 'text', text: 'no idea' }] };
        },
      },
    };
    const s = llmSampler({ llm, model: 'sonnet' });
    expect(await s.sample({ prompt: 'x' })).toBeNaN();
  });

  it('returns NaN on LLM error', async () => {
    const llm: LlmClient = {
      messages: {
        async create() {
          throw new Error('boom');
        },
      },
    };
    const s = llmSampler({ llm, model: 'sonnet' });
    expect(await s.sample({ prompt: 'x' })).toBeNaN();
  });
});

describe('functionSampler', () => {
  it('wraps a synchronous function', async () => {
    const s = functionSampler(() => 42);
    expect(await s.sample({ prompt: 'x' })).toBe(42);
  });

  it('wraps an async function', async () => {
    const s = functionSampler(async () => 99);
    expect(await s.sample({ prompt: 'x' })).toBe(99);
  });
});
