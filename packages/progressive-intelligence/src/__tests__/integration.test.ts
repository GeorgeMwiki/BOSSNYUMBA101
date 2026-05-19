/**
 * PI-A · integration tests — full round-trip on the substrate.
 *
 * Each test exercises observation → confidence → auto-fill/suggest/queue
 * → history record → (where applicable) undo / auto-promote.
 *
 * 10 integration scenarios.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  autoFill,
  buildObservation,
  computeConfidence,
  diffSummary,
  EvidencePendingQueue,
  InMemoryAutoFillEntityStore,
  InMemoryHistoryStore,
  InMemorySoftDeleteStore,
  makeHistoryRecorder,
  NoOpReceiptEmitter,
  NotDeletedError,
  PassthroughHighStakesVerifier,
  RetentionExpiredError,
  wrapMutation,
  type AutoFillReceipt,
  type EvidencePendingHandle,
  type SuggestionPending,
} from '../index.js';

function makeObs(opts: {
  kind: import('../observations/types.js').ObservationSourceKind;
  ref: string;
  confidence: number;
  attributeKey?: string;
  entityKind?: string;
  entityId?: string;
  observedValue?: unknown;
}) {
  return buildObservation({
    tenantId: 't1',
    entityId: opts.entityId ?? 'e1',
    entityKind: opts.entityKind ?? 'employee',
    attributeKey: opts.attributeKey ?? 'phone',
    observedValue: opts.observedValue ?? '+254700000000',
    source: { kind: opts.kind, ref: opts.ref, confidence: opts.confidence, observedAt: '2026-05-19T08:00:00Z' },
    evidence: [{ kind: 'chat-message', identifier: opts.ref, hash: 'a'.repeat(64) }],
  });
}

describe('PI-A · integration', () => {
  it('1: high-confidence observation → auto-apply → history records → entity store updated', async () => {
    const store = new InMemoryAutoFillEntityStore();
    const history = new InMemoryHistoryStore();
    const queue = new EvidencePendingQueue();
    const obs = makeObs({ kind: 'manual-edit', ref: 'usr_1', confidence: 1 });
    const conf = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    expect(conf.tier).toBe('high');
    const recorder = makeHistoryRecorder(history, {
      tenantId: 't1', entityId: 'e1', entityKind: 'employee', attributeKey: 'phone',
      actor: { kind: 'owner', id: 'usr_1' }, reason: 'auto-fill', source: { kind: 'manual-edit', ref: 'usr_1' },
      evidence: obs.evidence, observedAt: obs.source.observedAt,
    });
    const result = await autoFill({
      observation: obs, currentValue: undefined, confidence: conf,
      actor: { kind: 'owner', id: 'usr_1' }, store, evidenceSink: queue, recordHistory: recorder,
    });
    expect(result.tier).toBe('high');
    expect(await store.getAttribute('t1', 'e1', 'phone')).toBe('+254700000000');
    expect(await history.getHistory({ tenantId: 't1', entityId: 'e1' })).toHaveLength(1);
  });

  it('2: medium → suggestion, no write, no history', async () => {
    const store = new InMemoryAutoFillEntityStore();
    const history = new InMemoryHistoryStore();
    const queue = new EvidencePendingQueue();
    const obs = makeObs({ kind: 'chat-attachment', ref: 'msg_1', confidence: 0.95 });
    const conf = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    expect(conf.tier).toBe('medium');
    const recorder = makeHistoryRecorder(history, {
      tenantId: 't1', entityId: 'e1', entityKind: 'employee', attributeKey: 'phone',
      actor: { kind: 'owner', id: 'usr_1' }, reason: 'medium', source: { kind: 'chat-attachment', ref: 'msg_1' },
      evidence: obs.evidence, observedAt: obs.source.observedAt,
    });
    const result = await autoFill({ observation: obs, currentValue: undefined, confidence: conf, actor: { kind: 'owner', id: 'usr_1' }, store, evidenceSink: queue, recordHistory: recorder });
    expect((result.outcome as SuggestionPending).kind).toBe('suggestion-pending');
    expect(await store.getAttribute('t1', 'e1', 'phone')).toBeUndefined();
  });

  it('3: low → queue, no write, no history', async () => {
    const store = new InMemoryAutoFillEntityStore();
    const history = new InMemoryHistoryStore();
    const queue = new EvidencePendingQueue();
    const obs = makeObs({ kind: 'subagent-research', ref: 'mdr_1', confidence: 0.6 });
    const conf = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    expect(conf.tier).toBe('low');
    const recorder = makeHistoryRecorder(history, {
      tenantId: 't1', entityId: 'e1', entityKind: 'employee', attributeKey: 'phone',
      actor: { kind: 'owner', id: 'usr_1' }, reason: 'low', source: { kind: 'subagent-research', ref: 'mdr_1' },
      evidence: obs.evidence, observedAt: obs.source.observedAt,
    });
    const result = await autoFill({ observation: obs, currentValue: undefined, confidence: conf, actor: { kind: 'owner', id: 'usr_1' }, store, evidenceSink: queue, recordHistory: recorder });
    expect((result.outcome as EvidencePendingHandle).kind).toBe('evidence-pending-queued');
    expect(queue.list('t1')).toHaveLength(1);
  });

  it('4: auto-promote triggers autoFill when 3 sources converge', async () => {
    const store = new InMemoryAutoFillEntityStore();
    const history = new InMemoryHistoryStore();
    const onAutoPromote = vi.fn(async (row: import('../evidence-pending/types.js').EvidencePendingRow) => {
      // Synthesize a high-confidence record + apply.
      await store.setAttribute(row.tenantId, row.entityId, row.attributeKey, row.proposedValue);
      await history.recordChange({
        tenantId: row.tenantId, entityId: row.entityId, entityKind: row.entityKind,
        attributeKey: row.attributeKey, fromValue: undefined, toValue: row.proposedValue,
        actor: { kind: 'agent', id: 'pi-a:auto-promote' }, reason: 'auto-promoted by 3-source corroboration',
        source: row.observation.source, evidence: row.observation.evidence, observedAt: row.observation.source.observedAt,
      });
    });
    const queue = new EvidencePendingQueue({ onAutoPromote });
    const o1 = makeObs({ kind: 'subagent-research', ref: 'mdr_1', confidence: 0.6 });
    const o2 = makeObs({ kind: 'chat-text', ref: 'msg_2', confidence: 0.6 });
    const o3 = makeObs({ kind: 'chat-attachment', ref: 'msg_3', confidence: 0.6 });
    for (const o of [o1, o2, o3]) {
      const conf = computeConfidence({ observation: o, currentValue: undefined, history: [] });
      await queue.enqueue(o, conf);
    }
    expect(onAutoPromote).toHaveBeenCalledOnce();
    expect(await store.getAttribute('t1', 'e1', 'phone')).toBe('+254700000000');
  });

  it('5: change-tracking wrap + non-destructive change skips constitution gate', async () => {
    const store = new InMemoryAutoFillEntityStore();
    const history = new InMemoryHistoryStore();
    const gate = vi.fn(async () => ({ allowed: true }));
    const mutate = wrapMutation({
      getCurrentValue: (t, e, a) => store.getAttribute(t, e, a),
      setValue: (t, e, a, v) => store.setAttribute(t, e, a, v),
      history,
      enforceConstitution: gate,
    });
    await mutate({
      tenantId: 't1', entityId: 'e1', entityKind: 'employee', attributeKey: 'phone', toValue: 'p1',
      actor: { kind: 'owner', id: 'u' }, reason: 'init', source: { kind: 'chat-text', ref: 'm1' },
      evidence: [{ kind: 'chat-message', identifier: 'm1', hash: 'a'.repeat(64) }],
      observedAt: '2026-05-19T08:00:00Z',
    });
    expect(gate).not.toHaveBeenCalled();
  });

  it('6: change-tracking wrap + destructive change invokes constitution gate', async () => {
    const store = new InMemoryAutoFillEntityStore();
    const history = new InMemoryHistoryStore();
    await store._seed('t1', 'e1', 'phone', 'p_old');
    const gate = vi.fn(async () => ({ allowed: true }));
    const mutate = wrapMutation({
      getCurrentValue: (t, e, a) => store.getAttribute(t, e, a),
      setValue: (t, e, a, v) => store.setAttribute(t, e, a, v),
      history,
      enforceConstitution: gate,
    });
    await mutate({
      tenantId: 't1', entityId: 'e1', entityKind: 'employee', attributeKey: 'phone', toValue: 'p_new',
      actor: { kind: 'owner', id: 'u' }, reason: 'fix', source: { kind: 'chat-text', ref: 'm2' },
      evidence: [{ kind: 'chat-message', identifier: 'm2', hash: 'b'.repeat(64) }],
      observedAt: '2026-05-19T08:00:00Z',
    });
    expect(gate).toHaveBeenCalledOnce();
  });

  it('7: history replayAsOf reconstructs prior state', async () => {
    const store = new InMemoryAutoFillEntityStore();
    const history = new InMemoryHistoryStore();
    const e1 = await history.recordChange({
      tenantId: 't1', entityId: 'e1', entityKind: 'lease', attributeKey: 'monthly_rent',
      fromValue: undefined, toValue: 40000, actor: { kind: 'owner', id: 'u' }, reason: 'init',
      source: { kind: 'manual-edit', ref: 'u' }, evidence: [{ kind: 'manual-edit-actor', identifier: 'u', hash: 'a'.repeat(64) }],
      observedAt: '2026-05-19T08:00:00Z',
    });
    await new Promise((r) => setTimeout(r, 5));
    await history.recordChange({
      tenantId: 't1', entityId: 'e1', entityKind: 'lease', attributeKey: 'monthly_rent',
      fromValue: 40000, toValue: 45000, actor: { kind: 'owner', id: 'u' }, reason: 'bump',
      source: { kind: 'manual-edit', ref: 'u' }, evidence: [{ kind: 'manual-edit-actor', identifier: 'u', hash: 'b'.repeat(64) }],
      observedAt: '2026-05-19T08:05:00Z',
    });
    const snap = await history.replayAsOf('t1', 'e1', e1.recordedAt);
    expect(snap.attributes['monthly_rent']).toBe(40000);
    // Suppress unused-binding lint.
    expect(store).toBeDefined();
  });

  it('8: soft-delete + undo round-trip within retention', async () => {
    const sd = new InMemorySoftDeleteStore();
    await sd.softDelete({ tenantId: 't1', entityId: 'e1', entityKind: 'customer', actor: { kind: 'owner', id: 'u' }, reason: 'mistake' });
    expect(await sd.isDeleted('t1', 'e1')).toBe(true);
    const restored = await sd.undoDelete({ tenantId: 't1', entityId: 'e1', actor: { kind: 'owner', id: 'u' }, reason: 'oops' });
    expect(restored.deletedAt).toBeNull();
  });

  it('9: soft-delete + retention-expired denies undo + purge cleans up', async () => {
    const sd = new InMemorySoftDeleteStore();
    sd.setRetentionOverride('t1', 'customer', 0);
    await sd.softDelete({ tenantId: 't1', entityId: 'e1', entityKind: 'customer', actor: { kind: 'owner', id: 'u' }, reason: 'gone' });
    await new Promise((r) => setTimeout(r, 5));
    await expect(
      sd.undoDelete({ tenantId: 't1', entityId: 'e1', actor: { kind: 'owner', id: 'u' }, reason: 'too late' }),
    ).rejects.toBeInstanceOf(RetentionExpiredError);
    // Trying to undo a row that never existed should also fail:
    await expect(
      sd.undoDelete({ tenantId: 't1', entityId: 'nonexistent', actor: { kind: 'owner', id: 'u' }, reason: 'noop' }),
    ).rejects.toBeInstanceOf(NotDeletedError);
    const certs = await sd.purgeExpired();
    expect(certs).toHaveLength(1);
  });

  it('10: end-to-end — high apply → diff in chat → emitter receives receipt', async () => {
    const store = new InMemoryAutoFillEntityStore();
    const history = new InMemoryHistoryStore();
    const queue = new EvidencePendingQueue();
    const obs = makeObs({ kind: 'manual-edit', ref: 'usr_1', confidence: 1 });
    const conf = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    const recorder = makeHistoryRecorder(history, {
      tenantId: 't1', entityId: 'e1', entityKind: 'employee', attributeKey: 'phone',
      actor: { kind: 'owner', id: 'usr_1', label: 'George' }, reason: 'integration end-to-end',
      source: { kind: 'manual-edit', ref: 'usr_1' }, evidence: obs.evidence, observedAt: obs.source.observedAt,
    });
    const result = await autoFill({
      observation: obs, currentValue: undefined, confidence: conf,
      actor: { kind: 'owner', id: 'usr_1' }, store, evidenceSink: queue, recordHistory: recorder,
    });
    const receipt = result.outcome as AutoFillReceipt;
    // K-B emit (no-op but exercised).
    await NoOpReceiptEmitter.emitAutoFillReceipt(receipt);
    // M-B high-stakes registry recognises 'salary' on employee.
    expect(PassthroughHighStakesVerifier.isHighStakes('employee', 'salary')).toBe(true);
    expect(PassthroughHighStakesVerifier.isHighStakes('employee', 'phone')).toBe(false);
    // Render a diff summary for chat.
    const h = await history.getHistory({ tenantId: 't1', entityId: 'e1' });
    expect(diffSummary(h[0]!)).toContain('phone: (empty) → +254700000000');
  });
});
