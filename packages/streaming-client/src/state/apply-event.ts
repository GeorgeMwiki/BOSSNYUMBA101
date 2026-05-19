/**
 * Phase J8 — pure event-folding step for `OptimisticStateReducer`.
 *
 * Extracted from `optimistic-reducer.ts` so each file stays under the
 * 250-line cap (anti-stall rule). Keeping the pure reducer separate
 * also makes it trivially testable in isolation: every case below is a
 * function from (state, event) → state and can be exercised without
 * spinning up the class.
 *
 * CRITICAL: never mutate input state. Always return a new object.
 * See ~/.claude/rules/coding-style.md (Immutability).
 */

import type { ChatMessage, ChatStreamEvent, OptimisticChatState } from '../types.js';

/**
 * Pure reducer step. Returns the same reference when the event is a
 * no-op (so `OptimisticStateReducer.apply()` can fast-path the case
 * "nothing to dispatch").
 */
export function applyEvent(
  state: OptimisticChatState,
  event: ChatStreamEvent,
  nowMs: number,
): OptimisticChatState {
  switch (event.type) {
    case 'RUN_STARTED':
      return { ...state, threadId: event.threadId, runId: event.runId, lastError: null };

    case 'TEXT_MESSAGE_START': {
      const message: ChatMessage = {
        id: event.messageId,
        role: event.role,
        content: '',
        status: 'pending',
        firstTokenAt: null,
        lastTokenAt: null,
        parts: [],
        toolCalls: [],
      };
      return { ...state, messages: [...state.messages, message] };
    }

    case 'TEXT_MESSAGE_CONTENT':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === event.messageId
            ? {
                ...m,
                content: m.content + event.delta,
                firstTokenAt: m.firstTokenAt ?? nowMs,
                lastTokenAt: nowMs,
              }
            : m,
        ),
      };

    case 'TEXT_MESSAGE_END':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === event.messageId ? { ...m, status: 'complete' } : m,
        ),
      };

    case 'TOOL_CALL_START': {
      // Tool calls attach to the LAST pending assistant message — the
      // wire never re-targets a finished message.
      const lastIdx = state.messages.findLastIndex(
        (m) => m.status === 'pending' && m.role === 'assistant',
      );
      if (lastIdx === -1) return state;
      const updated = [...state.messages];
      const target = updated[lastIdx];
      if (!target) return state;
      updated[lastIdx] = {
        ...target,
        toolCalls: [...target.toolCalls, { id: event.toolCallId, name: event.name, args: '' }],
      };
      return { ...state, messages: updated };
    }

    case 'TOOL_CALL_ARGS':
      return {
        ...state,
        messages: state.messages.map((m) => ({
          ...m,
          toolCalls: m.toolCalls.map((t) =>
            t.id === event.toolCallId ? { ...t, args: t.args + event.delta } : t,
          ),
        })),
      };

    case 'TOOL_CALL_END':
      return {
        ...state,
        messages: state.messages.map((m) => ({
          ...m,
          toolCalls: m.toolCalls.map((t) =>
            t.id === event.toolCallId ? { ...t, result: event.result } : t,
          ),
        })),
      };

    case 'AG_UI_PART': {
      // AG-UI generative parts attach to the last pending assistant
      // message. If none exists we DROP the part rather than fabricate
      // a placeholder — a stray part with no anchor is a server bug.
      const lastIdx = state.messages.findLastIndex(
        (m) => m.status === 'pending' && m.role === 'assistant',
      );
      if (lastIdx === -1) return state;
      const updated = [...state.messages];
      const target = updated[lastIdx];
      if (!target) return state;
      // Idempotent insert — partId is the dedup key.
      if (target.parts.some((p) => p.id === event.partId)) return state;
      updated[lastIdx] = {
        ...target,
        parts: [
          ...target.parts,
          { id: event.partId, component: event.component, props: event.props },
        ],
      };
      return { ...state, messages: updated };
    }

    case 'PROACTIVE_RECOMMENDATION':
      // Idempotent on id.
      if (state.recommendations.some((r) => r.id === event.recommendation.id)) return state;
      return { ...state, recommendations: [...state.recommendations, event.recommendation] };

    case 'STATE_DELTA':
      // STATE_DELTA is opaque — the reducer keeps the patch shape
      // route-specific. The portal-level store does any merge.
      return state;

    case 'RUN_FINISHED':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.status === 'pending' ? { ...m, status: 'complete' } : m,
        ),
      };

    case 'RUN_ERROR':
      return {
        ...state,
        lastError: event.error,
        messages: state.messages.map((m) =>
          m.status === 'pending' ? { ...m, status: 'errored' } : m,
        ),
      };

    default: {
      // Exhaustiveness — TypeScript flags missing cases.
      const _exhaustive: never = event;
      void _exhaustive;
      return state;
    }
  }
}

export const EMPTY_STATE: OptimisticChatState = {
  threadId: null,
  runId: null,
  messages: [],
  recommendations: [],
  lastError: null,
};
