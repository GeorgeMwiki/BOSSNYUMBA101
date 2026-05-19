import { describe, expect, it } from 'vitest';

import { diffSummary, InMemoryHistoryStore, type RecordChangeInput } from '../history/index.js';

function baseInput(
  overrides: Partial<RecordChangeInput> = {},
): RecordChangeInput {
  return {
    tenantId: 't1',
    entityId: 'e1',
    entityKind: 'employee',
    attributeKey: 'phone',
    fromValue: undefined,
    toValue: '+254712345678',
    actor: { kind: 'owner', id: 'usr_1', label: 'George' },
    reason: 'observed in chat',
    source: { kind: 'chat-text', ref: 'msg_1' },
    evidence: [{ kind: 'chat-message', identifier: 'msg_1', hash: 'a'.repeat(64) }],
    observedAt: '2026-05-19T08:00:00Z',
    ...overrides,
  };
}

describe('history · recordChange + getHistory', () => {
  it('1: records a change and assigns id/recordedAt', async () => {
    const store = new InMemoryHistoryStore();
    const e = await store.recordChange(baseInput());
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(e.recordedAt)).not.toBeNaN();
    expect(Object.isFrozen(e)).toBe(true);
  });

  it('2: returns entries in chronological order, filtered by attribute', async () => {
    const store = new InMemoryHistoryStore();
    await store.recordChange(baseInput({ attributeKey: 'phone', toValue: 'p1' }));
    await store.recordChange(baseInput({ attributeKey: 'email', toValue: 'e1@x' }));
    await store.recordChange(baseInput({ attributeKey: 'phone', toValue: 'p2', fromValue: 'p1' }));
    const phoneOnly = await store.getHistory({ tenantId: 't1', entityId: 'e1', attributeKey: 'phone' });
    expect(phoneOnly).toHaveLength(2);
    expect(phoneOnly[0]?.toValue).toBe('p1');
    expect(phoneOnly[1]?.toValue).toBe('p2');
  });

  it('3: as-of filter excludes later entries', async () => {
    const store = new InMemoryHistoryStore();
    const first = await store.recordChange(baseInput({ toValue: 'p1' }));
    await new Promise((r) => setTimeout(r, 5));
    await store.recordChange(baseInput({ toValue: 'p2', fromValue: 'p1' }));
    const subset = await store.getHistory({ tenantId: 't1', entityId: 'e1', asOf: first.recordedAt });
    expect(subset).toHaveLength(1);
    expect(subset[0]?.toValue).toBe('p1');
  });

  it('4: supports supersedes pointer (correction)', async () => {
    const store = new InMemoryHistoryStore();
    const a = await store.recordChange(baseInput({ toValue: 'p1' }));
    const b = await store.recordChange(baseInput({ toValue: 'p1-fixed', fromValue: 'p1', supersedes: a.id }));
    expect(b.supersedes).toBe(a.id);
  });

  it('5: distinct entities do not bleed into each other', async () => {
    const store = new InMemoryHistoryStore();
    await store.recordChange(baseInput({ entityId: 'e1', toValue: 'A' }));
    await store.recordChange(baseInput({ entityId: 'e2', toValue: 'B' }));
    const e1History = await store.getHistory({ tenantId: 't1', entityId: 'e1' });
    expect(e1History).toHaveLength(1);
    expect(e1History[0]?.toValue).toBe('A');
  });

  it('6: validates ISO-8601 observedAt', async () => {
    const store = new InMemoryHistoryStore();
    await expect(store.recordChange(baseInput({ observedAt: 'yesterday' }))).rejects.toThrow();
  });
});

describe('history · replayAsOf', () => {
  it('7: reconstructs entity state at the recorded instant', async () => {
    const store = new InMemoryHistoryStore();
    const e1 = await store.recordChange(baseInput({ attributeKey: 'phone', toValue: 'p1' }));
    await new Promise((r) => setTimeout(r, 5));
    await store.recordChange(baseInput({ attributeKey: 'email', toValue: 'a@x' }));
    await new Promise((r) => setTimeout(r, 5));
    await store.recordChange(baseInput({ attributeKey: 'phone', toValue: 'p2', fromValue: 'p1' }));
    // At the time of e1's recordedAt, only phone=p1 should be visible.
    const snap = await store.replayAsOf('t1', 'e1', e1.recordedAt);
    expect(snap.attributes).toEqual({ phone: 'p1' });
  });

  it('8: replay returns frozen snapshot', async () => {
    const store = new InMemoryHistoryStore();
    await store.recordChange(baseInput());
    const snap = await store.replayAsOf('t1', 'e1', new Date().toISOString());
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.attributes)).toBe(true);
  });
});

describe('history · diffSummary', () => {
  it('renders a readable diff line with actor + reason', async () => {
    const store = new InMemoryHistoryStore();
    const e = await store.recordChange(baseInput({ fromValue: 'old', toValue: 'new' }));
    expect(diffSummary(e)).toContain('phone: old → new');
    expect(diffSummary(e)).toContain('by George');
    expect(diffSummary(e)).toContain('observed in chat');
  });

  it('renders (empty) for undefined fromValue', async () => {
    const store = new InMemoryHistoryStore();
    const e = await store.recordChange(baseInput({ fromValue: undefined, toValue: 'new' }));
    expect(diffSummary(e)).toContain('(empty) → new');
  });
});
