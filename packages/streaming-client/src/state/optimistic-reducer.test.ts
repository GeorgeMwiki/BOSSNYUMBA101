/**
 * Phase J8 — OptimisticStateReducer tests.
 */

import { describe, expect, it, vi } from 'vitest';
import { OptimisticStateReducer, applyEvent } from './optimistic-reducer.js';
import type { ChatStreamEvent, OptimisticChatState, ProactiveRecommendation } from '../types.js';

const EMPTY: OptimisticChatState = {
  threadId: null,
  runId: null,
  messages: [],
  recommendations: [],
  lastError: null,
};

describe('applyEvent (pure reducer step)', () => {
  it('RUN_STARTED sets thread and runId', () => {
    const next = applyEvent(EMPTY, { type: 'RUN_STARTED', threadId: 't', runId: 'r', timestamp: 1 }, 100);
    expect(next.threadId).toBe('t');
    expect(next.runId).toBe('r');
    expect(next.lastError).toBeNull();
  });

  it('TEXT_MESSAGE_START appends a pending message', () => {
    const next = applyEvent(EMPTY, { type: 'TEXT_MESSAGE_START', messageId: 'm1', runId: 'r', role: 'assistant' }, 100);
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]).toMatchObject({ id: 'm1', role: 'assistant', content: '', status: 'pending' });
  });

  it('TEXT_MESSAGE_CONTENT appends tokens and tracks firstTokenAt', () => {
    let s = EMPTY;
    s = applyEvent(s, { type: 'TEXT_MESSAGE_START', messageId: 'm1', runId: 'r', role: 'assistant' }, 100);
    s = applyEvent(s, { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'hi' }, 110);
    s = applyEvent(s, { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: ' there' }, 120);
    expect(s.messages[0]?.content).toBe('hi there');
    expect(s.messages[0]?.firstTokenAt).toBe(110);
    expect(s.messages[0]?.lastTokenAt).toBe(120);
  });

  it('TEXT_MESSAGE_END marks the message complete', () => {
    let s = applyEvent(EMPTY, { type: 'TEXT_MESSAGE_START', messageId: 'm1', runId: 'r', role: 'assistant' }, 100);
    s = applyEvent(s, { type: 'TEXT_MESSAGE_END', messageId: 'm1' }, 200);
    expect(s.messages[0]?.status).toBe('complete');
  });

  it('TOOL_CALL_START attaches to the last pending assistant message', () => {
    let s = applyEvent(EMPTY, { type: 'TEXT_MESSAGE_START', messageId: 'm1', runId: 'r', role: 'assistant' }, 100);
    s = applyEvent(s, { type: 'TOOL_CALL_START', toolCallId: 'tc1', runId: 'r', name: 'lookup' }, 110);
    expect(s.messages[0]?.toolCalls).toEqual([{ id: 'tc1', name: 'lookup', args: '' }]);
  });

  it('TOOL_CALL_START is a no-op when there is no pending assistant', () => {
    const s = applyEvent(EMPTY, { type: 'TOOL_CALL_START', toolCallId: 'tc1', runId: 'r', name: 'lookup' }, 100);
    expect(s).toEqual(EMPTY);
  });

  it('TOOL_CALL_ARGS accumulates args by id', () => {
    let s = applyEvent(EMPTY, { type: 'TEXT_MESSAGE_START', messageId: 'm1', runId: 'r', role: 'assistant' }, 100);
    s = applyEvent(s, { type: 'TOOL_CALL_START', toolCallId: 'tc1', runId: 'r', name: 'lookup' }, 110);
    s = applyEvent(s, { type: 'TOOL_CALL_ARGS', toolCallId: 'tc1', delta: '{"q":' }, 120);
    s = applyEvent(s, { type: 'TOOL_CALL_ARGS', toolCallId: 'tc1', delta: '"x"}' }, 130);
    expect(s.messages[0]?.toolCalls[0]?.args).toBe('{"q":"x"}');
  });

  it('TOOL_CALL_END attaches a result', () => {
    let s = applyEvent(EMPTY, { type: 'TEXT_MESSAGE_START', messageId: 'm1', runId: 'r', role: 'assistant' }, 100);
    s = applyEvent(s, { type: 'TOOL_CALL_START', toolCallId: 'tc1', runId: 'r', name: 'lookup' }, 110);
    s = applyEvent(s, { type: 'TOOL_CALL_END', toolCallId: 'tc1', result: { ok: true } }, 120);
    expect(s.messages[0]?.toolCalls[0]?.result).toEqual({ ok: true });
  });

  it('AG_UI_PART attaches to the last pending assistant message', () => {
    let s = applyEvent(EMPTY, { type: 'TEXT_MESSAGE_START', messageId: 'm1', runId: 'r', role: 'assistant' }, 100);
    s = applyEvent(s, { type: 'AG_UI_PART', partId: 'p1', runId: 'r', component: 'PropertyCard', props: { id: 'x' } }, 110);
    expect(s.messages[0]?.parts[0]).toMatchObject({ id: 'p1', component: 'PropertyCard' });
  });

  it('AG_UI_PART is idempotent on partId', () => {
    let s = applyEvent(EMPTY, { type: 'TEXT_MESSAGE_START', messageId: 'm1', runId: 'r', role: 'assistant' }, 100);
    s = applyEvent(s, { type: 'AG_UI_PART', partId: 'p1', runId: 'r', component: 'X', props: {} }, 110);
    s = applyEvent(s, { type: 'AG_UI_PART', partId: 'p1', runId: 'r', component: 'X', props: {} }, 120);
    expect(s.messages[0]?.parts).toHaveLength(1);
  });

  it('PROACTIVE_RECOMMENDATION is idempotent on id', () => {
    const rec: ProactiveRecommendation = { id: 'r1', tabId: 'rent-collection', title: 'T', body: 'B' };
    const s1 = applyEvent(EMPTY, { type: 'PROACTIVE_RECOMMENDATION', runId: 'r', recommendation: rec }, 100);
    const s2 = applyEvent(s1, { type: 'PROACTIVE_RECOMMENDATION', runId: 'r', recommendation: rec }, 110);
    expect(s2.recommendations).toHaveLength(1);
  });

  it('RUN_FINISHED forces remaining pending messages to complete', () => {
    let s = applyEvent(EMPTY, { type: 'TEXT_MESSAGE_START', messageId: 'm1', runId: 'r', role: 'assistant' }, 100);
    s = applyEvent(s, { type: 'RUN_FINISHED', runId: 'r', reason: 'completed' }, 200);
    expect(s.messages[0]?.status).toBe('complete');
  });

  it('RUN_ERROR records error + marks pending as errored', () => {
    let s = applyEvent(EMPTY, { type: 'TEXT_MESSAGE_START', messageId: 'm1', runId: 'r', role: 'assistant' }, 100);
    s = applyEvent(s, { type: 'RUN_ERROR', runId: 'r', error: 'kernel-timeout' }, 200);
    expect(s.lastError).toBe('kernel-timeout');
    expect(s.messages[0]?.status).toBe('errored');
  });

  it('STATE_DELTA is a no-op at the reducer level (portal owns the merge)', () => {
    const next = applyEvent(EMPTY, { type: 'STATE_DELTA', runId: 'r', patch: { x: 1 } }, 100);
    expect(next).toBe(EMPTY);
  });
});

describe('OptimisticStateReducer (instance)', () => {
  it('notifies listeners synchronously when batching is disabled', () => {
    const r = new OptimisticStateReducer({ tokenBatchMs: 0 });
    const seen: number[] = [];
    r.subscribe((s) => seen.push(s.messages.length));
    r.apply({ type: 'RUN_STARTED', threadId: 't', runId: 'r', timestamp: 1 });
    r.apply({ type: 'TEXT_MESSAGE_START', messageId: 'm', runId: 'r', role: 'assistant' });
    expect(seen).toEqual([0, 1]);
  });

  it('batches token events while non-token events flush immediately', () => {
    const scheduled: Array<() => void> = [];
    const r = new OptimisticStateReducer({
      tokenBatchMs: 50,
      scheduleFlush: (fn) => {
        scheduled.push(fn);
        return scheduled.length - 1;
      },
      cancelFlush: () => undefined,
    });
    let lastContent = '';
    r.subscribe((s) => {
      lastContent = s.messages[0]?.content ?? '';
    });
    r.apply({ type: 'RUN_STARTED', threadId: 't', runId: 'r', timestamp: 1 });
    r.apply({ type: 'TEXT_MESSAGE_START', messageId: 'm', runId: 'r', role: 'assistant' });
    expect(lastContent).toBe('');
    r.apply({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: 'a' });
    r.apply({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: 'b' });
    r.apply({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: 'c' });
    // No flush has happened yet — the scheduler hasn't been invoked.
    expect(lastContent).toBe('');
    scheduled[0]?.();
    expect(lastContent).toBe('abc');
    // Now an END event flushes immediately, despite being non-token.
    r.apply({ type: 'TEXT_MESSAGE_END', messageId: 'm' });
    expect(r.getState().messages[0]?.status).toBe('complete');
  });

  it('reset clears state and pending flushes', () => {
    const r = new OptimisticStateReducer();
    r.apply({ type: 'RUN_STARTED', threadId: 't', runId: 'r', timestamp: 1 });
    r.reset();
    expect(r.getState().threadId).toBeNull();
  });

  it('injectRecommendation respects idempotency', () => {
    const r = new OptimisticStateReducer();
    const rec: ProactiveRecommendation = { id: 'x', tabId: 'a', title: 't', body: 'b' };
    r.injectRecommendation(rec);
    r.injectRecommendation(rec);
    expect(r.getState().recommendations).toHaveLength(1);
  });

  it('isolates a throwing subscriber from other subscribers', () => {
    const r = new OptimisticStateReducer();
    const good: number[] = [];
    r.subscribe(() => {
      throw new Error('bad');
    });
    r.subscribe((s) => good.push(s.messages.length));
    r.apply({ type: 'TEXT_MESSAGE_START', messageId: 'm', runId: 'r', role: 'assistant' });
    expect(good).toEqual([1]);
  });

  it('exposes counters', () => {
    const r = new OptimisticStateReducer();
    r.apply({ type: 'RUN_STARTED', threadId: 't', runId: 'r', timestamp: 1 });
    r.apply({ type: 'TEXT_MESSAGE_START', messageId: 'm', runId: 'r', role: 'assistant' });
    const c = r.getCounters();
    expect(c.eventsApplied).toBe(2);
  });
});
