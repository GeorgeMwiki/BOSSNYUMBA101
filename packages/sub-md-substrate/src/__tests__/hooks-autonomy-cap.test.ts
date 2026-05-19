import { describe, expect, it } from 'vitest';
import { createCapTracker } from '../hooks/autonomy-cap.js';

describe('createCapTracker', () => {
  it('starts with the full cap remaining', () => {
    const t = createCapTracker({ maxSideEffects: 2, maxLlmCalls: 3, maxExternalCalls: 4 });
    expect(t.remaining()).toEqual({
      'side-effect': 2,
      'llm-call': 3,
      'external-call': 4,
    });
  });

  it('consume() decrements remaining within cap', () => {
    const t = createCapTracker({ maxSideEffects: 1, maxLlmCalls: 2, maxExternalCalls: 2 });
    const r1 = t.consume('llm-call');
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.remaining).toBe(1);
  });

  it('consume() refuses when amount would exceed cap', () => {
    const t = createCapTracker({ maxSideEffects: 1, maxLlmCalls: 1, maxExternalCalls: 1 });
    expect(t.consume('side-effect').ok).toBe(true);
    const r2 = t.consume('side-effect');
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toContain('side-effect cap exceeded');
  });

  it('does not bump used count on refusal', () => {
    const t = createCapTracker({ maxSideEffects: 0, maxLlmCalls: 0, maxExternalCalls: 0 });
    const r = t.consume('llm-call');
    expect(r.ok).toBe(false);
    expect(t.used()['llm-call']).toBe(0);
  });

  it('separate metrics are tracked independently', () => {
    const t = createCapTracker({ maxSideEffects: 1, maxLlmCalls: 1, maxExternalCalls: 1 });
    expect(t.consume('llm-call').ok).toBe(true);
    expect(t.consume('external-call').ok).toBe(true);
    expect(t.consume('side-effect').ok).toBe(true);
    expect(t.consume('llm-call').ok).toBe(false);
  });

  it('amount > 1 also blocked when over cap', () => {
    const t = createCapTracker({ maxSideEffects: 5, maxLlmCalls: 5, maxExternalCalls: 5 });
    expect(t.consume('llm-call', 6).ok).toBe(false);
    expect(t.consume('llm-call', 5).ok).toBe(true);
  });
});
