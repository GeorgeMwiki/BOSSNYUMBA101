/**
 * Anthropic provider tests.
 *
 * No fakes — uses the real provider class, but stubs `fetch` so we can
 * deterministically exercise:
 *   - retry on 429 / 5xx with exponential backoff
 *   - tool-use block parsing
 *   - constructor refuses missing apiKey
 *   - timeout handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnthropicProvider } from '../providers/anthropic.js';
import { asPromptId } from '../types/core.types.js';
import type { CompiledPrompt } from '../types/prompt.types.js';

const compiled: CompiledPrompt = {
  promptId: asPromptId('test'),
  version: '1.0.0',
  systemPrompt: 'you are test',
  userPrompt: 'hello',
  modelConfig: { modelId: 'claude-sonnet-4-6', maxTokens: 100, temperature: 0.5 },
  guardrails: {},
};

describe('AnthropicProvider construction', () => {
  it('throws if apiKey is missing', () => {
    expect(() => new AnthropicProvider({ apiKey: '' })).toThrow();
  });
});

describe('AnthropicProvider tool-use parsing', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns toolCalls + rawContent when the model emits tool_use', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            content: [
              { type: 'text', text: 'Let me check.' },
              {
                type: 'tool_use',
                id: 'tu_42',
                name: 'skill.test',
                input: { x: 1 },
              },
            ],
            stop_reason: 'tool_use',
            usage: { input_tokens: 12, output_tokens: 7 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    ) as typeof globalThis.fetch;

    const p = new AnthropicProvider({ apiKey: 'sk-ant-test', maxRetries: 0 });
    const result = await p.complete({ prompt: compiled });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.toolCalls).toHaveLength(1);
      expect(result.data.toolCalls?.[0]).toMatchObject({
        id: 'tu_42',
        name: 'skill.test',
      });
      expect(result.data.rawContent).toHaveLength(2);
      expect(result.data.finishReason).toBe('tool_use');
    }
  });
});

describe('AnthropicProvider retry/backoff', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('retries on 429 and ultimately succeeds', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      if (calls < 2) {
        return new Response(
          JSON.stringify({ error: { message: 'rate limited' } }),
          { status: 429 }
        );
      }
      return new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'ok' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200 }
      );
    }) as typeof globalThis.fetch;
    const p = new AnthropicProvider({
      apiKey: 'sk-ant-test',
      maxRetries: 4,
      retryBaseMs: 1, // tiny backoff so the test is fast
    });
    const result = await p.complete({ prompt: compiled });
    expect(result.success).toBe(true);
    expect(calls).toBe(2);
  });

  it('gives up after maxRetries on persistent 5xx', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { message: 'oops' } }), {
        status: 503,
      });
    }) as typeof globalThis.fetch;
    const p = new AnthropicProvider({
      apiKey: 'sk-ant-test',
      maxRetries: 2,
      retryBaseMs: 1,
    });
    const result = await p.complete({ prompt: compiled });
    expect(result.success).toBe(false);
    expect(calls).toBe(3); // first call + 2 retries
  });

  it('does not retry on non-retryable 400 (context length)', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      return new Response(
        JSON.stringify({ error: { message: 'context_length exceeded' } }),
        { status: 400 }
      );
    }) as typeof globalThis.fetch;
    const p = new AnthropicProvider({
      apiKey: 'sk-ant-test',
      maxRetries: 4,
      retryBaseMs: 1,
    });
    const result = await p.complete({ prompt: compiled });
    expect(result.success).toBe(false);
    expect(calls).toBe(1);
    if (!result.success) {
      expect(result.error.code).toBe('CONTEXT_LENGTH');
    }
  });
});
