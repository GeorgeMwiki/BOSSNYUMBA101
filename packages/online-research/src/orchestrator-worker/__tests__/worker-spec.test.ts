import { describe, it, expect } from 'vitest';
import { buildWorkerSpec, buildWorkerInput } from '../worker-spec.js';
import type { SubQuestion } from '../../types/index.js';

const baseSub: SubQuestion = {
  id: 'sq-1',
  question: 'What is the current KRA WHT rate on rental income?',
  rationale: 'Need official rate for KRA filing',
  preferredProviders: ['tavily', 'anthropic'],
  dependsOn: [],
};

describe('buildWorkerSpec', () => {
  it('always includes core tools', () => {
    const spec = buildWorkerSpec({ subQuestion: baseSub, depth: 'standard' });
    expect(spec.allowed_tools).toContain('web_search');
    expect(spec.allowed_tools).toContain('web_fetch');
    expect(spec.allowed_tools).toContain('code_execution');
  });
  it('adds provider-specific tools', () => {
    const spec = buildWorkerSpec({ subQuestion: baseSub, depth: 'standard' });
    expect(spec.allowed_tools).toContain('web_search_tavily');
  });
  it('NEVER includes the Agent tool — workers cannot spawn', () => {
    const spec = buildWorkerSpec({ subQuestion: baseSub, depth: 'deep' });
    expect(spec.allowed_tools).not.toContain('Agent');
  });
  it('isolated_context is always true', () => {
    const spec = buildWorkerSpec({ subQuestion: baseSub, depth: 'quick' });
    expect(spec.isolated_context).toBe(true);
  });
  it('scales max_turns by depth', () => {
    const quick = buildWorkerSpec({ subQuestion: baseSub, depth: 'quick' });
    const std = buildWorkerSpec({ subQuestion: baseSub, depth: 'standard' });
    const deep = buildWorkerSpec({ subQuestion: baseSub, depth: 'deep' });
    expect(quick.max_turns).toBeLessThan(std.max_turns);
    expect(std.max_turns).toBeLessThan(deep.max_turns);
  });
  it('uses sonnet model + effort matching depth', () => {
    const quick = buildWorkerSpec({ subQuestion: baseSub, depth: 'quick' });
    expect(quick.model).toBe('sonnet');
    expect(quick.effort).toBe('low');
    const std = buildWorkerSpec({ subQuestion: baseSub, depth: 'standard' });
    expect(std.effort).toBe('medium');
    const deep = buildWorkerSpec({ subQuestion: baseSub, depth: 'deep' });
    expect(deep.effort).toBe('high');
  });
  it('emits a sorted unique tool list', () => {
    const spec = buildWorkerSpec({
      subQuestion: { ...baseSub, preferredProviders: ['tavily', 'tavily', 'anthropic'] },
      depth: 'standard',
    });
    const seen = new Set(spec.allowed_tools);
    expect(seen.size).toBe(spec.allowed_tools.length);
    expect([...spec.allowed_tools]).toEqual([...spec.allowed_tools].slice().sort());
  });
});

describe('buildWorkerInput', () => {
  it('passes only the sub-question, never parent context', () => {
    const input = buildWorkerInput({ subQuestion: baseSub, correlationId: 'corr-1' });
    expect(input.prompt).toBe(baseSub.question);
    expect(input.correlation_id).toBe('corr-1');
    // No parent context fields exist on the input type
    expect(Object.keys(input)).toEqual(expect.arrayContaining(['prompt', 'structured_input', 'correlation_id']));
    expect(Object.keys(input)).not.toContain('parentHistory');
  });
  it('serialises structured_input deterministically', () => {
    const input = buildWorkerInput({ subQuestion: baseSub, correlationId: 'corr-1' });
    expect(input.structured_input).toEqual({
      subQuestionId: 'sq-1',
      preferredProviders: ['tavily', 'anthropic'],
      rationale: 'Need official rate for KRA filing',
    });
  });
});
