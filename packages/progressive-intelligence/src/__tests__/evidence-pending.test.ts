import { describe, expect, it, vi } from 'vitest';

import { computeConfidence } from '../confidence/index.js';
import { EvidencePendingQueue } from '../evidence-pending/index.js';
import { buildObservation, type ObservationSourceKind } from '../observations/index.js';

function makeLowObs(
  kind: ObservationSourceKind,
  ref: string,
  value: unknown = 'A',
  attributeKey = 'phone',
  entityId = 'e1',
) {
  return buildObservation({
    tenantId: 't1',
    entityId,
    entityKind: 'employee',
    attributeKey,
    observedValue: value,
    source: { kind, ref, confidence: 0.6, observedAt: '2026-05-19T08:00:00Z' },
    evidence: [{ kind: 'chat-message', identifier: ref, hash: 'a'.repeat(64) }],
  });
}

describe('evidence-pending · queue lifecycle', () => {
  it('1: enqueue creates a row with status=open', async () => {
    const q = new EvidencePendingQueue();
    const obs = makeLowObs('subagent-research', 'mdr_1');
    const conf = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    const id = await q.enqueue(obs, conf);
    const row = q.get(id);
    expect(row?.status).toBe('open');
    expect(row?.proposedValue).toBe('A');
  });

  it('2: list() returns rows scoped to tenant', async () => {
    const q = new EvidencePendingQueue();
    const obs = makeLowObs('subagent-research', 'mdr_1');
    const conf = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    await q.enqueue(obs, conf);
    expect(q.list('t1')).toHaveLength(1);
    expect(q.list('t_other')).toHaveLength(0);
  });

  it('3: approve transitions to status=approved', async () => {
    const q = new EvidencePendingQueue();
    const obs = makeLowObs('subagent-research', 'mdr_1');
    const conf = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    const id = await q.enqueue(obs, conf);
    const updated = await q.approve(id, 'looks right');
    expect(updated.status).toBe('approved');
    expect(updated.resolutionReason).toBe('looks right');
    expect(updated.resolvedAt).toBeDefined();
  });

  it('4: reject transitions to status=rejected', async () => {
    const q = new EvidencePendingQueue();
    const obs = makeLowObs('subagent-research', 'mdr_1');
    const conf = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    const id = await q.enqueue(obs, conf);
    const updated = await q.reject(id, 'wrong person');
    expect(updated.status).toBe('rejected');
  });

  it('5: requestMore transitions to awaiting_evidence', async () => {
    const q = new EvidencePendingQueue();
    const obs = makeLowObs('subagent-research', 'mdr_1');
    const conf = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    const id = await q.enqueue(obs, conf);
    const updated = await q.requestMore(id, 'show me the source');
    expect(updated.status).toBe('awaiting_evidence');
  });

  it('6: subsequent enqueue with same value coalesces to existing open row', async () => {
    const q = new EvidencePendingQueue();
    const obs1 = makeLowObs('subagent-research', 'mdr_1');
    const obs2 = makeLowObs('chat-text', 'msg_2');
    const conf = computeConfidence({ observation: obs1, currentValue: undefined, history: [] });
    const id1 = await q.enqueue(obs1, conf);
    const id2 = await q.enqueue(obs2, conf);
    expect(id1).toBe(id2);
    expect(q.get(id1)?.corroboratingSourceKinds.size).toBe(2);
  });

  it('7: auto-promote when 3 independent source kinds confirm', async () => {
    const handler = vi.fn(async () => {});
    const q = new EvidencePendingQueue({ onAutoPromote: handler });
    const obsA = makeLowObs('subagent-research', 'mdr_1');
    const obsB = makeLowObs('chat-text', 'msg_2');
    const obsC = makeLowObs('chat-attachment', 'msg_3');
    const conf = computeConfidence({ observation: obsA, currentValue: undefined, history: [] });
    const id = await q.enqueue(obsA, conf);
    await q.enqueue(obsB, conf);
    await q.enqueue(obsC, conf);
    const final = q.get(id);
    expect(final?.status).toBe('auto_promoted');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('8: distinct values create distinct rows', async () => {
    const q = new EvidencePendingQueue();
    const obs1 = makeLowObs('subagent-research', 'mdr_1', 'A');
    const obs2 = makeLowObs('subagent-research', 'mdr_2', 'B');
    const conf = computeConfidence({ observation: obs1, currentValue: undefined, history: [] });
    const id1 = await q.enqueue(obs1, conf);
    const id2 = await q.enqueue(obs2, conf);
    expect(id1).not.toBe(id2);
  });
});
