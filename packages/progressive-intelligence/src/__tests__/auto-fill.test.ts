import { describe, expect, it } from 'vitest';

import { computeConfidence } from '../confidence/index.js';
import { InMemoryHistoryStore } from '../history/index.js';
import {
  autoFill,
  InMemoryAutoFillEntityStore,
  InMemoryEvidencePendingSink,
  makeHistoryRecorder,
  type AutoFillReceipt,
  type EvidencePendingHandle,
  type SuggestionPending,
} from '../auto-fill/index.js';
import { buildObservation, type ObservationSourceKind } from '../observations/index.js';

function setup() {
  const store = new InMemoryAutoFillEntityStore();
  const history = new InMemoryHistoryStore();
  const sink = new InMemoryEvidencePendingSink();
  const obs = buildObservation({
    tenantId: 't1',
    entityId: 'e1',
    entityKind: 'employee',
    attributeKey: 'phone',
    observedValue: '+254700000001',
    source: { kind: 'manual-edit' as ObservationSourceKind, ref: 'usr_1', confidence: 1, observedAt: '2026-05-19T08:00:00Z' },
    evidence: [{ kind: 'manual-edit-actor', identifier: 'usr_1', hash: 'a'.repeat(64) }],
  });
  const recorder = makeHistoryRecorder(history, {
    tenantId: 't1',
    entityId: 'e1',
    entityKind: 'employee',
    attributeKey: 'phone',
    actor: { kind: 'owner', id: 'usr_1', label: 'George' },
    reason: 'auto-fill high-confidence',
    source: { kind: 'manual-edit', ref: 'usr_1' },
    evidence: obs.evidence,
    observedAt: obs.source.observedAt,
  });
  return { store, history, sink, obs, recorder };
}

describe('auto-fill · high tier', () => {
  it('1: writes attribute, records history, returns receipt with undo token', async () => {
    const { store, sink, obs, recorder } = setup();
    const confidence = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    expect(confidence.tier).toBe('high');
    const result = await autoFill({
      observation: obs,
      currentValue: undefined,
      confidence,
      actor: { kind: 'owner', id: 'usr_1' },
      store,
      evidenceSink: sink,
      recordHistory: recorder,
    });
    expect(result.tier).toBe('high');
    const receipt = result.outcome as AutoFillReceipt;
    expect(receipt.kind).toBe('auto-fill-receipt');
    expect(receipt.undoToken).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt.toValue).toBe('+254700000001');
    expect(await store.getAttribute('t1', 'e1', 'phone')).toBe('+254700000001');
  });

  it('2: receipt undoableUntil respects rollback window', async () => {
    const { store, sink, obs, recorder } = setup();
    const confidence = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    const result = await autoFill({
      observation: obs,
      currentValue: undefined,
      confidence,
      actor: { kind: 'owner', id: 'usr_1' },
      store,
      evidenceSink: sink,
      recordHistory: recorder,
      rollbackWindowMs: 60_000,
    });
    const receipt = result.outcome as AutoFillReceipt;
    const deadline = Date.parse(receipt.undoableUntil);
    expect(deadline - Date.now()).toBeLessThanOrEqual(60_000 + 1000);
  });
});

describe('auto-fill · medium tier', () => {
  it('3: returns SuggestionPending; no write, no history', async () => {
    const { store, history, sink, recorder } = setup();
    const obs = buildObservation({
      tenantId: 't1',
      entityId: 'e1',
      entityKind: 'employee',
      attributeKey: 'phone',
      observedValue: '+254700000002',
      source: { kind: 'chat-attachment', ref: 'msg_1:att_1', confidence: 0.95, observedAt: '2026-05-19T08:00:00Z' },
      evidence: [{ kind: 'chat-message', identifier: 'msg_1', hash: 'b'.repeat(64) }],
    });
    const confidence = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    expect(confidence.tier).toBe('medium');
    const result = await autoFill({
      observation: obs,
      currentValue: undefined,
      confidence,
      actor: { kind: 'owner', id: 'usr_1' },
      store,
      evidenceSink: sink,
      recordHistory: recorder,
    });
    expect(result.tier).toBe('medium');
    const sug = result.outcome as SuggestionPending;
    expect(sug.kind).toBe('suggestion-pending');
    expect(sug.proposedValue).toBe('+254700000002');
    expect(await store.getAttribute('t1', 'e1', 'phone')).toBeUndefined();
    expect((await history.getHistory({ tenantId: 't1', entityId: 'e1' })).length).toBe(0);
  });

  it('4: suggestion id is deterministic per observation', async () => {
    const { store, sink, recorder } = setup();
    const obs = buildObservation({
      tenantId: 't1',
      entityId: 'e1',
      entityKind: 'employee',
      attributeKey: 'phone',
      observedValue: '+254700000002',
      source: { kind: 'chat-attachment', ref: 'msg_1:att_1', confidence: 0.95, observedAt: '2026-05-19T08:00:00Z' },
      evidence: [{ kind: 'chat-message', identifier: 'msg_1', hash: 'b'.repeat(64) }],
    });
    const confidence = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    const r1 = await autoFill({ observation: obs, currentValue: undefined, confidence, actor: { kind: 'owner', id: 'u' }, store, evidenceSink: sink, recordHistory: recorder });
    const r2 = await autoFill({ observation: obs, currentValue: undefined, confidence, actor: { kind: 'owner', id: 'u' }, store, evidenceSink: sink, recordHistory: recorder });
    expect((r1.outcome as SuggestionPending).suggestionId).toBe((r2.outcome as SuggestionPending).suggestionId);
  });
});

describe('auto-fill · low tier', () => {
  it('5: enqueues to evidence-pending; no store write, no history', async () => {
    const { store, history, sink, recorder } = setup();
    const obs = buildObservation({
      tenantId: 't1',
      entityId: 'e1',
      entityKind: 'employee',
      attributeKey: 'phone',
      observedValue: '+254700000003',
      source: { kind: 'subagent-research', ref: 'mdr_1', confidence: 0.6, observedAt: '2026-05-19T08:00:00Z' },
      evidence: [{ kind: 'subagent-citation', identifier: 'src_1', hash: 'c'.repeat(64) }],
    });
    const confidence = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    expect(confidence.tier).toBe('low');
    const result = await autoFill({
      observation: obs,
      currentValue: undefined,
      confidence,
      actor: { kind: 'owner', id: 'usr_1' },
      store,
      evidenceSink: sink,
      recordHistory: recorder,
    });
    expect(result.tier).toBe('low');
    const handle = result.outcome as EvidencePendingHandle;
    expect(handle.kind).toBe('evidence-pending-queued');
    expect(sink.list()).toHaveLength(1);
    expect(await store.getAttribute('t1', 'e1', 'phone')).toBeUndefined();
    expect((await history.getHistory({ tenantId: 't1', entityId: 'e1' })).length).toBe(0);
  });
});

describe('auto-fill · rollback verification (round-trip set/read)', () => {
  it('6: high-tier change is visible through entity store + history', async () => {
    const { store, history, sink, obs, recorder } = setup();
    const confidence = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    await autoFill({
      observation: obs,
      currentValue: undefined,
      confidence,
      actor: { kind: 'owner', id: 'usr_1' },
      store,
      evidenceSink: sink,
      recordHistory: recorder,
    });
    const written = await store.getAttribute('t1', 'e1', 'phone');
    expect(written).toBe('+254700000001');
    const h = await history.getHistory({ tenantId: 't1', entityId: 'e1' });
    expect(h).toHaveLength(1);
    expect(h[0]?.toValue).toBe('+254700000001');
  });
});
