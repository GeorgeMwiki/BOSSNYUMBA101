import { describe, expect, it } from 'vitest';
import {
  createCompile,
  type CompileReport,
  type CompileStrategy,
} from '../primitives/compile.js';
import { makeCtx } from './_helpers.js';

interface TestInput {
  readonly v: number;
}

interface TestReport extends CompileReport {
  readonly sum: number;
}

const sumStrategy: CompileStrategy<TestInput, TestReport> = {
  async compile({ inputs, window }) {
    const s = inputs.reduce((a, b) => a + b.v, 0);
    return {
      title: 'sum',
      window,
      aggregates: { sum: s },
      topN: [],
      anomalies: [],
      recommendedActions: [],
      inputsExamined: inputs.length,
      sum: s,
    };
  },
};

describe('createCompile', () => {
  it('aggregates inputs and produces a report', async () => {
    const comp = createCompile({ name: 'c.sum', strategy: sumStrategy });
    const { ctx, recorder } = makeCtx();
    const r = await comp.run({
      inputs: [{ v: 1 }, { v: 2 }, { v: 3 }],
      window: { startMs: 0, endMs: 10 },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.sum).toBe(6);
    expect(recorder.entries[0]!.status).toBe('draft');
  });

  it('rejects when inputs exceed maxInputs', async () => {
    const comp = createCompile({
      name: 'c.too-many',
      strategy: sumStrategy,
      maxInputs: 2,
    });
    const { ctx, recorder } = makeCtx();
    await comp.run({
      inputs: [{ v: 1 }, { v: 2 }, { v: 3 }],
      window: { startMs: 0, endMs: 10 },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(recorder.entries[0]!.status).toBe('rejected');
  });

  it('rejects cross-tenant input', async () => {
    const comp = createCompile({ name: 'c.scope', strategy: sumStrategy });
    const { ctx, recorder } = makeCtx({ tenantId: 'tenant-1' });
    await comp.run({
      inputs: [{ v: 1 }],
      window: { startMs: 0, endMs: 10 },
      inputTenantId: 'tenant-x',
      ctx,
    });
    expect(recorder.entries[0]!.status).toBe('rejected');
  });

  it('handles empty input list without throwing', async () => {
    const comp = createCompile({ name: 'c.empty', strategy: sumStrategy });
    const { ctx } = makeCtx();
    const r = await comp.run({
      inputs: [],
      window: { startMs: 0, endMs: 10 },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.sum).toBe(0);
  });
});
