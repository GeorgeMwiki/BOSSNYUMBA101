/**
 * Substrate-wide contract invariants — every primitive in the package
 * must respect these rules. Cross-primitive properties are asserted here
 * so adding a new primitive surfaces a regression immediately.
 */

import { describe, expect, it } from 'vitest';
import { createTriage } from '../primitives/triage.js';
import { createDispatch, type DispatchTransportPort } from '../primitives/dispatch.js';
import { createDraft } from '../primitives/draft.js';
import { createChase, type ChaseLadder } from '../primitives/chase.js';
import { createCompile } from '../primitives/compile.js';
import { createReconcile } from '../primitives/reconcile.js';
import { ledgerEntrySchema } from '../types.js';
import { createLedgerRecorder } from '../util/ledger-recorder.js';
import { makeCtx } from './_helpers.js';

const noopTransport: DispatchTransportPort<string> = {
  async send({ candidate }) {
    return { externalMessageId: candidate.id };
  },
};

const ladder: ChaseLadder = {
  rungs: [
    { index: 0, label: 'r0', channel: 'email', cooldownMs: 1 },
    { index: 1, label: 'r1', channel: 'sms', cooldownMs: 1 },
  ],
  handoffAtRung: 1,
};

async function runAllPrimitives(mode: 'dry-run' | 'propose' | 'act-on-yes' | 'auto') {
  const recorder = createLedgerRecorder();
  const { ctx } = makeCtx({ mode, ledger: recorder });

  // Triage
  await createTriage({
    name: 't',
    strategy: {
      async classify() {
        return { label: 'x', confidence: 0.95, rationale: 'r' };
      },
    },
  }).run({ input: { id: 'x' }, inputTenantId: 'tenant-1', ctx });

  // Dispatch
  await createDispatch({
    name: 'd',
    selector: {
      async pick({ candidates }) {
        return { chosen: candidates[0]!, fallbacks: candidates.slice(1) };
      },
    },
    transport: noopTransport,
  }).run({
    classification: { label: 'x' },
    candidates: [{ id: 'a', displayName: 'A', score: 1, channel: 'email' }],
    payload: {},
    inputTenantId: 'tenant-1',
    ctx,
  });

  // Draft
  await createDraft({
    name: 'df',
    strategy: {
      async draft() {
        return {
          subject: 'x',
          body: 'y',
          format: 'plain',
          languageTag: 'en',
          piiRedacted: true,
        };
      },
    },
  }).run({ input: { x: 1 }, inputTenantId: 'tenant-1', ctx });

  // Chase
  await createChase({ name: 'c', ladder }).run({
    target: { id: 't' },
    inputTenantId: 'tenant-1',
    history: [],
    ctx,
  });

  // Compile
  await createCompile({
    name: 'co',
    strategy: {
      async compile({ inputs, window }) {
        return {
          title: 't',
          window,
          aggregates: {},
          topN: [],
          anomalies: [],
          recommendedActions: [],
          inputsExamined: inputs.length,
        };
      },
    },
  }).run({
    inputs: [{ v: 1 }],
    window: { startMs: 0, endMs: 1 },
    inputTenantId: 'tenant-1',
    ctx,
  });

  // Reconcile
  await createReconcile({
    name: 're',
    strategy: {
      async reconcile() {
        return {
          matches: [],
          leftOnly: [],
          rightOnly: [],
          suggestedActions: [],
          totalLeft: 0,
          totalRight: 0,
        };
      },
    },
  }).run({
    left: [],
    right: [],
    inputTenantId: 'tenant-1',
    ctx,
  });

  return recorder.snapshot();
}

describe('substrate invariants — every primitive across every mode', () => {
  it('always emits exactly one ledger entry per primitive call', async () => {
    const entries = await runAllPrimitives('propose');
    expect(entries.length).toBe(6);
  });

  it('every emitted entry passes the schema', async () => {
    const entries = await runAllPrimitives('act-on-yes');
    for (const e of entries) {
      const parsed = ledgerEntrySchema.safeParse(e);
      expect(parsed.success).toBe(true);
    }
  });

  it('dry-run mode emits no side effects across all primitives', async () => {
    const entries = await runAllPrimitives('dry-run');
    for (const e of entries) {
      expect(e.sideEffectCount).toBe(0);
      expect(e.status).toBe('dry-run');
    }
  });

  it('propose mode emits no side effects across all primitives', async () => {
    const entries = await runAllPrimitives('propose');
    for (const e of entries) {
      expect(e.sideEffectCount).toBe(0);
    }
  });

  it('inputHash and outputHash are 16-char hex on every entry', async () => {
    const entries = await runAllPrimitives('propose');
    for (const e of entries) {
      expect(e.inputHash).toMatch(/^[0-9a-f]{16}$/);
      expect(e.outputHash).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it('correlationId is propagated to every entry', async () => {
    const entries = await runAllPrimitives('auto');
    for (const e of entries) {
      expect(e.correlationId).toBe('corr-1');
    }
  });

  it('each entry tags its primitive kind correctly', async () => {
    const entries = await runAllPrimitives('propose');
    const kinds = entries.map((e) => e.primitiveKind).sort();
    expect(kinds).toEqual(
      ['chase', 'compile', 'dispatch', 'draft', 'reconcile', 'triage'].sort(),
    );
  });
});
