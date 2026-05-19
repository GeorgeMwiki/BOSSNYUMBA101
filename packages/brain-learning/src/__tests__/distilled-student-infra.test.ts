/**
 * distilled-student-infra tests.
 *
 * Covers:
 *   - OllamaClient round-trip via mocked fetch
 *   - VLLMClient round-trip via mocked fetch
 *   - BedrockHaikuClient invokeFn delegation + cost passthrough
 *   - resolver routes to student when STUDENT_MODEL_PATH set AND ready
 *   - resolver falls back to N-C cascade when no checkpoint OR not ready
 */

import { describe, it, expect, vi } from 'vitest';
import {
  OllamaClient,
  VLLMClient,
  BedrockHaikuClient,
  resolveStudentClient,
  type IStudentModelClient,
  type NcCostCascadeFallback,
} from '../distilled-student-infra/index.js';

// ──────────────────── Ollama ──────────────────────────────────────

describe('OllamaClient', () => {
  it('round-trip /api/generate', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'student-output' }),
    } as Response);
    const clockSeq = [0, 42];
    const clock = vi.fn(() => new Date(clockSeq.shift() ?? 0));
    const client = new OllamaClient({
      endpoint: 'http://localhost:11434',
      modelTag: 'qwen2.5-7b',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      clock,
    });
    const out = await client.invoke({ prompt: 'P' });
    expect(out.content).toBe('student-output');
    expect(out.costUsdCents).toBe(0); // self-hosted
    expect(out.adapter).toBe('ollama');
    expect(out.latencyMs).toBe(42);
  });

  it('isReady returns false when endpoint unreachable', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error('connection refused'));
    const client = new OllamaClient({
      endpoint: 'http://localhost:11434',
      modelTag: 'qwen2.5-7b',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(await client.isReady()).toBe(false);
  });
});

// ──────────────────── vLLM ────────────────────────────────────────

describe('VLLMClient', () => {
  it('round-trip OpenAI-compatible chat completions', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'vllm-output' } }],
      }),
    } as Response);
    const clockSeq = [0, 13];
    const clock = vi.fn(() => new Date(clockSeq.shift() ?? 0));
    const client = new VLLMClient({
      endpoint: 'http://vllm:8000',
      modelName: 'qwen2.5-7b',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      clock,
    });
    const out = await client.invoke({ prompt: 'P', system: 'S' });
    expect(out.content).toBe('vllm-output');
    expect(out.adapter).toBe('vllm');
  });

  it('throws on non-OK response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);
    const client = new VLLMClient({
      endpoint: 'http://vllm:8000',
      modelName: 'qwen2.5-7b',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(client.invoke({ prompt: 'P' })).rejects.toThrow(/500/);
  });
});

// ──────────────────── Bedrock ─────────────────────────────────────

describe('BedrockHaikuClient', () => {
  it('delegates to invokeFn and passes cost through', async () => {
    const invokeFn = vi.fn().mockResolvedValue({
      content: 'bedrock-out',
      costUsdCents: 15,
      latencyMs: 80,
    });
    const client = new BedrockHaikuClient({
      region: 'us-east-1',
      modelId: 'haiku-4.5',
      invokeFn,
    });
    const out = await client.invoke({ prompt: 'P' });
    expect(out.content).toBe('bedrock-out');
    expect(out.costUsdCents).toBe(15);
    expect(out.adapter).toBe('bedrock-haiku');
  });

  it('isReady returns true (managed service)', async () => {
    const client = new BedrockHaikuClient({
      region: 'us-east-1',
      modelId: 'haiku-4.5',
      invokeFn: vi.fn(),
    });
    expect(await client.isReady()).toBe(true);
  });
});

// ──────────────────── Resolver ────────────────────────────────────

describe('resolveStudentClient', () => {
  it('uses primary when STUDENT_MODEL_PATH set AND ready', async () => {
    const primary: IStudentModelClient = {
      adapter: 'vllm',
      isReady: async () => true,
      invoke: vi.fn().mockResolvedValue({
        content: 'student-says-hi',
        costUsdCents: 0,
        latencyMs: 50,
        adapter: 'vllm',
      }),
    };
    const fallback: NcCostCascadeFallback = {
      invoke: vi.fn().mockResolvedValue({
        content: 'should-not-be-called',
        costUsdCents: 5,
        latencyMs: 100,
        adapter: 'fallback',
      }),
    };
    const client = await resolveStudentClient({
      primary,
      fallback,
      studentModelPath: '/checkpoints/qwen-25-7b-bossnyumba',
    });
    expect(client.adapter).toBe('vllm');
    const out = await client.invoke({ prompt: 'P' });
    expect(out.content).toBe('student-says-hi');
    expect(fallback.invoke).not.toHaveBeenCalled();
  });

  it('falls back when STUDENT_MODEL_PATH unset', async () => {
    const primary: IStudentModelClient = {
      adapter: 'vllm',
      isReady: async () => true,
      invoke: vi.fn(),
    };
    const fallback: NcCostCascadeFallback = {
      invoke: vi.fn().mockResolvedValue({
        content: 'haiku-fallback',
        costUsdCents: 5,
        latencyMs: 100,
        adapter: 'fallback',
      }),
    };
    const client = await resolveStudentClient({
      primary,
      fallback,
      // studentModelPath undefined
    });
    expect(client.adapter).toBe('fallback');
    const out = await client.invoke({ prompt: 'P' });
    expect(out.content).toBe('haiku-fallback');
    expect(primary.invoke).not.toHaveBeenCalled();
  });

  it('falls back when primary not ready (checkpoint not loaded)', async () => {
    const primary: IStudentModelClient = {
      adapter: 'ollama',
      isReady: async () => false,
      invoke: vi.fn(),
    };
    const fallback: NcCostCascadeFallback = {
      invoke: vi.fn().mockResolvedValue({
        content: 'haiku-fallback',
        costUsdCents: 5,
        latencyMs: 100,
        adapter: 'fallback',
      }),
    };
    const client = await resolveStudentClient({
      primary,
      fallback,
      studentModelPath: '/checkpoints/qwen-25-7b',
    });
    expect(client.adapter).toBe('fallback');
  });

  it('falls back when no primary supplied', async () => {
    const fallback: NcCostCascadeFallback = {
      invoke: vi.fn().mockResolvedValue({
        content: 'h',
        costUsdCents: 5,
        latencyMs: 100,
        adapter: 'fallback',
      }),
    };
    const client = await resolveStudentClient({
      fallback,
      studentModelPath: '/some/path',
    });
    expect(client.adapter).toBe('fallback');
  });
});
