import { describe, expect, it, vi } from 'vitest';

import { InMemoryAutoFillEntityStore } from '../auto-fill/index.js';
import { ALLOW_ALL_CONSTITUTION, ConstitutionDeniedError, wrapMutation } from '../change-tracking/index.js';
import { InMemoryHistoryStore } from '../history/index.js';
import type { MutationContext } from '../change-tracking/types.js';

function baseCtx(over: Partial<MutationContext> = {}): MutationContext {
  return {
    tenantId: 't1',
    entityId: 'e1',
    entityKind: 'employee',
    attributeKey: 'phone',
    toValue: '+254700000000',
    actor: { kind: 'owner', id: 'usr_1', label: 'George' },
    reason: 'tested',
    source: { kind: 'chat-text', ref: 'msg_1' },
    evidence: [{ kind: 'chat-message', identifier: 'msg_1', hash: 'a'.repeat(64) }],
    observedAt: '2026-05-19T08:00:00Z',
    ...over,
  };
}

function setup() {
  const store = new InMemoryAutoFillEntityStore();
  const history = new InMemoryHistoryStore();
  return { store, history };
}

describe('change-tracking · wrapMutation', () => {
  it('1: applies non-destructive change without invoking constitution gate', async () => {
    const { store, history } = setup();
    const gate = vi.fn(ALLOW_ALL_CONSTITUTION);
    const mutate = wrapMutation({
      getCurrentValue: (t, e, a) => store.getAttribute(t, e, a),
      setValue: (t, e, a, v) => store.setAttribute(t, e, a, v),
      history,
      enforceConstitution: gate,
    });
    const result = await mutate(baseCtx());
    expect(result.toValue).toBe('+254700000000');
    expect(gate).not.toHaveBeenCalled();
    expect(await store.getAttribute('t1', 'e1', 'phone')).toBe('+254700000000');
    expect((await history.getHistory({ tenantId: 't1', entityId: 'e1' }))).toHaveLength(1);
  });

  it('2: invokes constitution gate for destructive change (overwrite)', async () => {
    const { store, history } = setup();
    await store._seed('t1', 'e1', 'phone', 'old');
    const gate = vi.fn(ALLOW_ALL_CONSTITUTION);
    const mutate = wrapMutation({
      getCurrentValue: (t, e, a) => store.getAttribute(t, e, a),
      setValue: (t, e, a, v) => store.setAttribute(t, e, a, v),
      history,
      enforceConstitution: gate,
    });
    await mutate(baseCtx({ toValue: 'new' }));
    expect(gate).toHaveBeenCalledOnce();
  });

  it('3: throws ConstitutionDeniedError when gate denies destructive change', async () => {
    const { store, history } = setup();
    await store._seed('t1', 'e1', 'phone', 'old');
    const mutate = wrapMutation({
      getCurrentValue: (t, e, a) => store.getAttribute(t, e, a),
      setValue: (t, e, a, v) => store.setAttribute(t, e, a, v),
      history,
      enforceConstitution: async () => ({ allowed: false, principle: 'no-rent-rewrite', reasoning: 'tenant must consent' }),
    });
    await expect(mutate(baseCtx({ toValue: 'new' }))).rejects.toBeInstanceOf(ConstitutionDeniedError);
    // The destructive write must NOT have been applied.
    expect(await store.getAttribute('t1', 'e1', 'phone')).toBe('old');
  });

  it('4: emits ChangeRecord block with historyEntryId + actor + reason', async () => {
    const { store, history } = setup();
    const mutate = wrapMutation({
      getCurrentValue: (t, e, a) => store.getAttribute(t, e, a),
      setValue: (t, e, a, v) => store.setAttribute(t, e, a, v),
      history,
      enforceConstitution: ALLOW_ALL_CONSTITUTION,
    });
    const { changeRecord } = await mutate(baseCtx());
    expect(changeRecord.kind).toBe('change-record');
    expect(changeRecord.historyEntryId).toMatch(/^[0-9a-f-]{36}$/);
    expect(changeRecord.actor.label).toBe('George');
    expect(changeRecord.reason).toBe('tested');
    expect(Object.isFrozen(changeRecord)).toBe(true);
  });

  it('5: same-value re-write is not destructive (idempotent confirm)', async () => {
    const { store, history } = setup();
    await store._seed('t1', 'e1', 'phone', '+254700000000');
    const gate = vi.fn(ALLOW_ALL_CONSTITUTION);
    const mutate = wrapMutation({
      getCurrentValue: (t, e, a) => store.getAttribute(t, e, a),
      setValue: (t, e, a, v) => store.setAttribute(t, e, a, v),
      history,
      enforceConstitution: gate,
    });
    await mutate(baseCtx({ toValue: '+254700000000' }));
    expect(gate).not.toHaveBeenCalled();
  });

  it('6: history entry is created with correct fromValue + toValue', async () => {
    const { store, history } = setup();
    await store._seed('t1', 'e1', 'phone', 'old');
    const mutate = wrapMutation({
      getCurrentValue: (t, e, a) => store.getAttribute(t, e, a),
      setValue: (t, e, a, v) => store.setAttribute(t, e, a, v),
      history,
      enforceConstitution: ALLOW_ALL_CONSTITUTION,
    });
    await mutate(baseCtx({ toValue: 'new' }));
    const h = await history.getHistory({ tenantId: 't1', entityId: 'e1', attributeKey: 'phone' });
    expect(h).toHaveLength(1);
    expect(h[0]?.fromValue).toBe('old');
    expect(h[0]?.toValue).toBe('new');
  });
});
