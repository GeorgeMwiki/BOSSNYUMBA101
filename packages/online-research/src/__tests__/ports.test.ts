/**
 * Smoke tests for the in-memory port adapters.
 */

import { describe, it, expect } from 'vitest';
import {
  createInMemoryBudgetMonitor,
  createInMemoryDeferHook,
  createInMemoryLLMOrchestrator,
  createInMemorySubAgentRunner,
} from '../ports/index.js';
import type { SubAgentSpec } from '../ports/index.js';

const NOW = 1747632000000;
const clock = { nowMs: () => NOW };
let counter = 0;
const tokenGen = () => `tok_${++counter}`;

describe('createInMemoryBudgetMonitor', () => {
  it('allows spending under the cap', async () => {
    const m = createInMemoryBudgetMonitor({ tenantMonthlyCapUsd: 100 });
    const v = await m.preflight({
      tenantId: 'a',
      conversationId: 'c1',
      description: 'op',
      estimatedCostUsd: 5,
      estimatedSeconds: 10,
      requiresApproval: false,
    });
    expect(v.kind).toBe('allowed');
  });
  it('denies when tenant cap would be exceeded', async () => {
    const m = createInMemoryBudgetMonitor({
      tenantMonthlyCapUsd: 100,
      initialTenantSpentUsd: 99,
    });
    const v = await m.preflight({
      tenantId: 'a',
      conversationId: 'c1',
      description: 'op',
      estimatedCostUsd: 5,
      estimatedSeconds: 10,
      requiresApproval: false,
    });
    expect(v.kind).toBe('denied');
  });
  it('denies on conversation cap exceeded', async () => {
    const m = createInMemoryBudgetMonitor({
      tenantMonthlyCapUsd: 100,
      conversationCapUsd: 10,
    });
    await m.record({ tenantId: 'a', conversationId: 'c1', actualCostUsd: 9, description: 'op' });
    const v = await m.preflight({
      tenantId: 'a',
      conversationId: 'c1',
      description: 'op',
      estimatedCostUsd: 2,
      estimatedSeconds: 5,
      requiresApproval: false,
    });
    expect(v.kind).toBe('denied');
  });
  it('returns approval_required when configured', async () => {
    const m = createInMemoryBudgetMonitor({
      tenantMonthlyCapUsd: 1000,
      approvalThresholdUsd: 5,
    });
    const v = await m.preflight({
      tenantId: 'a',
      conversationId: 'c1',
      description: 'op',
      estimatedCostUsd: 10,
      estimatedSeconds: 30,
      requiresApproval: false,
    });
    expect(v.kind).toBe('approval_required');
  });
  it('updates tally on record', async () => {
    const m = createInMemoryBudgetMonitor({ tenantMonthlyCapUsd: 100 });
    await m.record({ tenantId: 'a', conversationId: 'c1', actualCostUsd: 12.5, description: 'op' });
    expect(m.tenantSpentUsd()).toBe(12.5);
    expect(m.conversationSpentUsd('c1')).toBe(12.5);
  });
});

describe('createInMemoryDeferHook', () => {
  it('issues a resumeToken + records pending', async () => {
    const d = createInMemoryDeferHook({ clock, tokenGen });
    const r = await d.requestDefer({
      tenantId: 't',
      correlationId: 'c',
      reason: 'approval',
      payload: { foo: 'bar' },
    });
    expect(r.resumeToken).toMatch(/^def_/u);
    expect(d.pendingTokens()).toContain(r.resumeToken);
  });
  it('returns the payload on resume', async () => {
    const d = createInMemoryDeferHook({ clock, tokenGen });
    const r = await d.requestDefer({
      tenantId: 't',
      correlationId: 'c',
      reason: 'r',
      payload: { x: 1 },
    });
    const payload = await d.resume(r.resumeToken);
    expect(payload?.payload).toEqual({ x: 1 });
  });
  it('returns null for unknown tokens', async () => {
    const d = createInMemoryDeferHook({ clock, tokenGen });
    expect(await d.resume('unknown')).toBeNull();
  });
  it('records scheduled wake time when resumeAfterMs is set', async () => {
    const d = createInMemoryDeferHook({ clock, tokenGen });
    const r = await d.requestDefer({
      tenantId: 't',
      correlationId: 'c',
      reason: 'wake',
      payload: {},
      resumeAfterMs: 60_000,
    });
    expect(r.scheduledWakeAt).toBeDefined();
  });
});

describe('createInMemorySubAgentRunner', () => {
  const baseSpec: SubAgentSpec = {
    name: 'researcher',
    description: 'researches',
    allowed_tools: ['web_search'],
    system_prompt: 'be brief',
    max_turns: 5,
    isolated_context: true,
  };

  it('throws when isolated_context is false', async () => {
    const runner = createInMemorySubAgentRunner({
      simulator: async () => ({ output: {}, turns_used: 1, cost_usd: 0 }),
    });
    await expect(
      runner.spawnSubAgent(
        { ...baseSpec, isolated_context: false as unknown as true },
        { prompt: 'p', correlation_id: 'c' },
      ),
    ).rejects.toThrow(/isolated_context/iu);
  });

  it('throws when allowed_tools contains "Agent"', async () => {
    const runner = createInMemorySubAgentRunner({
      simulator: async () => ({ output: {}, turns_used: 1, cost_usd: 0 }),
    });
    await expect(
      runner.spawnSubAgent(
        { ...baseSpec, allowed_tools: ['Agent', 'web_search'] },
        { prompt: 'p', correlation_id: 'c' },
      ),
    ).rejects.toThrow(/Agent.*allowed_tools/iu);
  });

  it('catches simulator throws and returns error result', async () => {
    const runner = createInMemorySubAgentRunner({
      simulator: async () => {
        throw new Error('boom');
      },
    });
    const r = await runner.spawnSubAgent(baseSpec, { prompt: 'p', correlation_id: 'c' });
    expect(r.status).toBe('error');
    expect(r.error?.code).toBe('simulator_threw');
  });

  it('passes through simulator output verbatim', async () => {
    const runner = createInMemorySubAgentRunner({
      simulator: async () => ({
        output: { foo: 'bar' },
        turns_used: 3,
        cost_usd: 0.05,
      }),
    });
    const r = await runner.spawnSubAgent(baseSpec, { prompt: 'p', correlation_id: 'c' });
    expect(r.status).toBe('ok');
    expect(r.output).toEqual({ foo: 'bar' });
  });
});

describe('createInMemoryLLMOrchestrator', () => {
  it('produces a plan with at least 1 sub-question for quick depth', async () => {
    const llm = createInMemoryLLMOrchestrator({ clock });
    const r = await llm.plan({ question: 'test', depth: 'quick', maxWorkers: 7 });
    expect(r.subQuestions.length).toBeGreaterThanOrEqual(1);
  });

  it('synthesizes a non-empty report given OK worker outputs', async () => {
    const llm = createInMemoryLLMOrchestrator({ clock });
    const r = await llm.synthesize({
      question: 'q',
      workerOutputs: [
        {
          subQuestionId: 'sq-1',
          summary: 'finding 1',
          hits: [
            {
              url: 'https://example.com/x',
              title: 'X',
              snippet: 's',
              provider: 'anthropic',
              score: 0.9,
            },
          ],
          costUsd: 0.1,
          elapsedMs: 100,
          status: 'ok',
        },
      ],
    });
    expect(r.report).toContain('finding 1');
    expect(r.citations).toHaveLength(1);
  });

  it('produces a "no results" report when all workers fail', async () => {
    const llm = createInMemoryLLMOrchestrator({ clock });
    const r = await llm.synthesize({
      question: 'q',
      workerOutputs: [
        {
          subQuestionId: 'sq-1',
          summary: '',
          hits: [],
          costUsd: 0,
          elapsedMs: 0,
          status: 'error',
        },
      ],
    });
    expect(r.report).toMatch(/no usable results/iu);
  });
});
