import { describe, expect, it, vi } from 'vitest';
import {
  createDispatch,
  type DispatchCandidate,
  type DispatchSelector,
  type DispatchTransportPort,
} from '../primitives/dispatch.js';
import { makeCtx } from './_helpers.js';

interface TestClassification {
  readonly label: string;
}

const candidates: ReadonlyArray<DispatchCandidate<string>> = [
  { id: 'a', displayName: 'Alpha', score: 0.4, channel: 'email' },
  { id: 'b', displayName: 'Beta', score: 0.9, channel: 'email' },
  { id: 'c', displayName: 'Gamma', score: 0.6, channel: 'sms' },
];

const topScoreSelector: DispatchSelector<TestClassification, string> = {
  async pick({ candidates: cs }) {
    const sorted = [...cs].sort((x, y) => y.score - x.score);
    return { chosen: sorted[0]!, fallbacks: sorted.slice(1) };
  },
};

function makeTransport(): DispatchTransportPort<string> & {
  readonly calls: ReadonlyArray<DispatchCandidate<string>>;
} {
  const calls: DispatchCandidate<string>[] = [];
  return {
    get calls() {
      return calls;
    },
    async send({ candidate }) {
      calls.push(candidate);
      return { externalMessageId: `msg-${candidate.id}-${calls.length}` };
    },
  };
}

describe('createDispatch', () => {
  it('emits draft + no external send in propose mode', async () => {
    const transport = makeTransport();
    const dispatch = createDispatch({
      name: 'd.propose',
      selector: topScoreSelector,
      transport,
    });
    const { ctx, recorder } = makeCtx({ mode: 'propose' });
    const r = await dispatch.run({
      classification: { label: 'L' },
      candidates,
      payload: {},
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.chosen.id).toBe('b');
    expect(r.output.externalMessageId).toBe(null);
    expect(transport.calls.length).toBe(0);
    expect(recorder.entries[0]!.status).toBe('draft');
    expect(recorder.entries[0]!.sideEffectCount).toBe(0);
  });

  it('actually sends + seals entry in auto mode', async () => {
    const transport = makeTransport();
    const dispatch = createDispatch({
      name: 'd.auto',
      selector: topScoreSelector,
      transport,
    });
    const { ctx, recorder } = makeCtx({ mode: 'auto' });
    const r = await dispatch.run({
      classification: { label: 'L' },
      candidates,
      payload: { msg: 'hi' },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(transport.calls.length).toBe(1);
    expect(r.output.externalMessageId).toMatch(/^msg-b-/);
    expect(recorder.entries[0]!.status).toBe('sealed');
    expect(recorder.entries[0]!.sideEffectCount).toBe(1);
  });

  it('blocks send when external-call cap exhausted', async () => {
    const transport = makeTransport();
    const sendSpy = vi.spyOn(transport, 'send');
    const dispatch = createDispatch({
      name: 'd.cap',
      selector: topScoreSelector,
      transport,
    });
    const { ctx, recorder } = makeCtx({
      mode: 'auto',
      autonomyCap: { maxSideEffects: 1, maxLlmCalls: 1, maxExternalCalls: 0 },
    });
    const r = await dispatch.run({
      classification: { label: 'L' },
      candidates,
      payload: {},
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(sendSpy).not.toHaveBeenCalled();
    expect(r.output.externalMessageId).toBe(null);
    expect(recorder.entries[0]!.status).toBe('rejected');
  });

  it('rejects when candidate pool is empty', async () => {
    const transport = makeTransport();
    const dispatch = createDispatch({
      name: 'd.empty',
      selector: topScoreSelector,
      transport,
    });
    const { ctx, recorder } = makeCtx({ mode: 'auto' });
    const r = await dispatch.run({
      classification: { label: 'L' },
      candidates: [],
      payload: {},
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.externalMessageId).toBe(null);
    expect(recorder.entries[0]!.status).toBe('rejected');
  });

  it('caps fallbacks to maxFallbacks', async () => {
    const transport = makeTransport();
    const dispatch = createDispatch({
      name: 'd.fallback',
      selector: topScoreSelector,
      transport,
      maxFallbacks: 1,
    });
    const { ctx } = makeCtx({ mode: 'propose' });
    const r = await dispatch.run({
      classification: { label: 'L' },
      candidates,
      payload: {},
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.fallbacks.length).toBe(1);
  });

  it('rejects cross-tenant input', async () => {
    const transport = makeTransport();
    const dispatch = createDispatch({
      name: 'd.scope',
      selector: topScoreSelector,
      transport,
    });
    const { ctx, recorder } = makeCtx({ tenantId: 'tenant-1', mode: 'auto' });
    const r = await dispatch.run({
      classification: { label: 'L' },
      candidates,
      payload: {},
      inputTenantId: 'tenant-zzz',
      ctx,
    });
    expect(r.output.externalMessageId).toBe(null);
    expect(recorder.entries[0]!.status).toBe('rejected');
  });
});
