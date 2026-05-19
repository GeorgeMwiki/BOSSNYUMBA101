import { describe, expect, it } from 'vitest';
import { createTriage } from '../primitives/triage.js';
import type { TriageStrategy } from '../primitives/triage.js';
import { makeCtx } from './_helpers.js';

interface TestInput {
  readonly id: string;
  readonly text: string;
}

interface TestClassification {
  readonly label: 'red' | 'green';
  readonly confidence: number;
  readonly rationale: string;
}

const stubStrategy = (
  label: 'red' | 'green',
  confidence: number,
): TriageStrategy<TestInput, TestClassification> => ({
  async classify({ input }) {
    return { label, confidence, rationale: `input=${input.id}` };
  },
});

describe('createTriage', () => {
  it('returns a classification + sealed ledger entry in propose mode', async () => {
    const { ctx, recorder } = makeCtx({ mode: 'propose' });
    const triage = createTriage<TestInput, TestClassification>({
      name: 't.test',
      strategy: stubStrategy('red', 0.9),
    });
    const r = await triage.run({
      input: { id: 'x', text: 'urgent leak' },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.label).toBe('red');
    expect(r.ledgerEntry.status).toBe('draft');
    expect(r.ledgerEntry.sideEffectCount).toBe(0);
    expect(recorder.entries.length).toBe(1);
  });

  it('downgrades auto→draft when confidence is below floor', async () => {
    const { ctx } = makeCtx({ mode: 'auto' });
    const triage = createTriage<TestInput, TestClassification>({
      name: 't.lowconf',
      strategy: stubStrategy('red', 0.5),
      minConfidenceForAuto: 0.8,
    });
    const r = await triage.run({
      input: { id: 'x', text: 'leak' },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.ledgerEntry.status).toBe('draft');
  });

  it('keeps sealed when confidence >= floor in auto mode', async () => {
    const { ctx } = makeCtx({ mode: 'auto' });
    const triage = createTriage<TestInput, TestClassification>({
      name: 't.hiconf',
      strategy: stubStrategy('red', 0.9),
      minConfidenceForAuto: 0.8,
    });
    const r = await triage.run({
      input: { id: 'x', text: 'leak' },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.ledgerEntry.status).toBe('sealed');
  });

  it('rejects cross-tenant input', async () => {
    const { ctx, recorder } = makeCtx({ tenantId: 'tenant-1' });
    const triage = createTriage<TestInput, TestClassification>({
      name: 't.scope',
      strategy: stubStrategy('red', 0.9),
    });
    const r = await triage.run({
      input: { id: 'x', text: 'leak' },
      inputTenantId: 'tenant-2',
      ctx,
    });
    expect(r.ledgerEntry.status).toBe('rejected');
    expect(recorder.entries[0]!.summary).toMatch(/cross-tenant/);
  });

  it('hashes input and output deterministically', async () => {
    const { ctx: ctx1, recorder: r1 } = makeCtx();
    const { ctx: ctx2, recorder: r2 } = makeCtx();
    const triage = createTriage<TestInput, TestClassification>({
      name: 't.hash',
      strategy: stubStrategy('green', 0.9),
    });
    await triage.run({ input: { id: 'a', text: 'x' }, inputTenantId: 'tenant-1', ctx: ctx1 });
    await triage.run({ input: { id: 'a', text: 'x' }, inputTenantId: 'tenant-1', ctx: ctx2 });
    expect(r1.entries[0]!.inputHash).toBe(r2.entries[0]!.inputHash);
    expect(r1.entries[0]!.outputHash).toBe(r2.entries[0]!.outputHash);
  });

  it('emits dry-run status in dry-run mode', async () => {
    const { ctx } = makeCtx({ mode: 'dry-run' });
    const triage = createTriage<TestInput, TestClassification>({
      name: 't.dry',
      strategy: stubStrategy('green', 0.99),
    });
    const r = await triage.run({
      input: { id: 'x', text: 'ok' },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.ledgerEntry.status).toBe('dry-run');
  });

  it('strategy may consume an llm call', async () => {
    let consumed = false;
    const strategy: TriageStrategy<TestInput, TestClassification> = {
      async classify({ recordLlmCall }) {
        consumed = recordLlmCall();
        return { label: 'green', confidence: 0.9, rationale: 'r' };
      },
    };
    const { ctx } = makeCtx();
    const triage = createTriage({ name: 't.llm', strategy });
    await triage.run({ input: { id: 'x', text: '' }, inputTenantId: 'tenant-1', ctx });
    expect(consumed).toBe(true);
  });

  it('strategy refused when cap is 0', async () => {
    let consumed = true;
    const strategy: TriageStrategy<TestInput, TestClassification> = {
      async classify({ recordLlmCall }) {
        consumed = recordLlmCall();
        return { label: 'green', confidence: 0.9, rationale: 'r' };
      },
    };
    const { ctx } = makeCtx({
      autonomyCap: { maxSideEffects: 0, maxLlmCalls: 0, maxExternalCalls: 0 },
    });
    const triage = createTriage({ name: 't.cap', strategy });
    await triage.run({ input: { id: 'x', text: '' }, inputTenantId: 'tenant-1', ctx });
    expect(consumed).toBe(false);
  });
});
