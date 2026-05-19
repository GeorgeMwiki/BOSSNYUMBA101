import { describe, it, expect } from 'vitest';
import {
  clampWorkerCount,
  suggestWorkerCount,
  toposortSubQuestions,
  validatePlan,
} from '../decompose.js';
import type { SubQuestion } from '../../types/index.js';

const sq = (id: string, dependsOn: ReadonlyArray<string> = []): SubQuestion => ({
  id,
  question: `Sub-question ${id}`,
  rationale: 'rationale',
  preferredProviders: ['anthropic'],
  dependsOn,
});

describe('clampWorkerCount', () => {
  it('clamps to 1 when proposed is 0 or negative', () => {
    expect(clampWorkerCount(0, 'standard')).toBe(1);
    expect(clampWorkerCount(-5, 'standard')).toBe(1);
  });
  it('clamps to depth-appropriate cap when proposed exceeds it', () => {
    expect(clampWorkerCount(20, 'quick')).toBe(1);
    expect(clampWorkerCount(20, 'standard')).toBe(4);
    expect(clampWorkerCount(20, 'deep')).toBe(7);
  });
  it('respects explicit maxWorkers override', () => {
    expect(clampWorkerCount(20, 'deep', 3)).toBe(3);
    expect(clampWorkerCount(2, 'deep', 5)).toBe(2);
  });
  it('returns proposed when within bounds', () => {
    expect(clampWorkerCount(2, 'standard')).toBe(2);
    expect(clampWorkerCount(5, 'deep')).toBe(5);
  });
});

describe('suggestWorkerCount', () => {
  it('returns 1 for quick depth regardless of question', () => {
    expect(suggestWorkerCount('compare A vs B and C', 'quick')).toBe(1);
  });
  it('detects comparison questions at standard depth', () => {
    expect(suggestWorkerCount('compare vendor A vs vendor B', 'standard')).toBe(4);
  });
  it('detects multi-facet questions', () => {
    expect(suggestWorkerCount('rent rate and KRA filings', 'standard')).toBe(3);
  });
  it('scales up for deep depth', () => {
    expect(suggestWorkerCount('simple question', 'deep')).toBe(4);
    expect(suggestWorkerCount('A vs B', 'deep')).toBe(5);
    expect(suggestWorkerCount('A and B', 'deep')).toBe(6);
  });
});

describe('toposortSubQuestions', () => {
  it('returns empty waves for empty input', () => {
    expect(toposortSubQuestions([])).toEqual([]);
  });
  it('emits independent items in one wave', () => {
    const subs = [sq('a'), sq('b'), sq('c')];
    const waves = toposortSubQuestions(subs);
    expect(waves).toHaveLength(1);
    expect(waves[0]).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });
  it('emits dependent items in subsequent waves', () => {
    const subs = [sq('a'), sq('b', ['a']), sq('c', ['b'])];
    const waves = toposortSubQuestions(subs);
    expect(waves).toEqual([['a'], ['b'], ['c']]);
  });
  it('groups independent dependents in the same wave', () => {
    const subs = [sq('a'), sq('b', ['a']), sq('c', ['a'])];
    const waves = toposortSubQuestions(subs);
    expect(waves[0]).toEqual(['a']);
    expect(waves[1]).toEqual(expect.arrayContaining(['b', 'c']));
  });
  it('throws on cycles', () => {
    const subs = [sq('a', ['b']), sq('b', ['a'])];
    expect(() => toposortSubQuestions(subs)).toThrow(/cycle/iu);
  });
  it('throws on unknown dependency', () => {
    const subs = [sq('a', ['phantom'])];
    expect(() => toposortSubQuestions(subs)).toThrow(/unknown dependency/iu);
  });
});

describe('validatePlan', () => {
  it('accepts a valid plan', () => {
    const plan = [sq('a'), sq('b')];
    const r = validatePlan(plan, 'standard');
    expect(r.ok).toBe(true);
  });
  it('rejects empty plans', () => {
    const r = validatePlan([], 'standard');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.join(' ')).toMatch(/empty/iu);
    }
  });
  it('rejects duplicate ids', () => {
    const plan = [sq('a'), sq('a')];
    const r = validatePlan(plan, 'standard');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.join(' ')).toMatch(/duplicate/iu);
    }
  });
  it('rejects plans larger than depth cap', () => {
    const plan = [sq('a'), sq('b'), sq('c'), sq('d'), sq('e')];
    const r = validatePlan(plan, 'standard');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.join(' ')).toMatch(/cap is 4/iu);
    }
  });
  it('rejects cyclic plans', () => {
    const plan = [sq('a', ['b']), sq('b', ['a'])];
    const r = validatePlan(plan, 'standard');
    expect(r.ok).toBe(false);
  });
  it('rejects plans with no preferred providers', () => {
    const plan: SubQuestion[] = [
      {
        ...sq('a'),
        preferredProviders: [],
      },
    ];
    const r = validatePlan(plan, 'standard');
    expect(r.ok).toBe(false);
  });
});
