/**
 * turn-reducer — fold a stream of AgentEvent values into an
 * AgentTurnState. Pure, immutable, no mutation of input.
 */

import type { AgentEvent, AgentTurnState, StoredTurn } from './types';

export function emptyAgentTurn(turnId: string): AgentTurnState {
  return {
    turnId,
    status: 'streaming',
    plan: null,
    thoughts: [],
    toolCalls: [],
    text: '',
    citations: [],
    artifacts: [],
    error: null,
    totalMs: null,
  };
}

export function applyEvent(state: AgentTurnState, event: AgentEvent): AgentTurnState {
  switch (event.kind) {
    case 'plan':
      return { ...state, plan: [...event.steps] };
    case 'thought':
      return { ...state, thoughts: [...state.thoughts, event.text] };
    case 'tool_call':
      return {
        ...state,
        toolCalls: [
          ...state.toolCalls,
          { callId: event.callId, toolName: event.toolName, status: 'running' },
        ],
      };
    case 'tool_result': {
      const nextCalls = state.toolCalls.map((call) => {
        if (call.callId !== event.callId) return call;
        if (event.outcome.kind === 'error') {
          return {
            ...call,
            status: 'failed' as const,
            errorMessage: event.outcome.message,
          };
        }
        return {
          ...call,
          status: 'done' as const,
          latencyMs: event.outcome.latencyMs,
        };
      });
      const artifact =
        event.outcome.kind === 'ok' && event.outcome.artifact
          ? [...state.artifacts, event.outcome.artifact]
          : state.artifacts;
      const citations =
        event.outcome.kind === 'ok' && event.outcome.citations.length > 0
          ? dedupeCitations([...state.citations, ...event.outcome.citations])
          : state.citations;
      return {
        ...state,
        toolCalls: nextCalls,
        artifacts: artifact,
        citations,
      };
    }
    case 'text':
      return { ...state, text: state.text + event.delta };
    case 'citation':
      return {
        ...state,
        citations: dedupeCitations([...state.citations, event.citation]),
      };
    case 'artifact':
      return { ...state, artifacts: [...state.artifacts, event.artifact] };
    case 'error':
      return { ...state, status: 'error', error: event.message };
    case 'done':
      return {
        ...state,
        status: 'done',
        turnId: event.turnId,
        totalMs: event.totalMs,
      };
    default:
      return state;
  }
}

function dedupeCitations<C extends { readonly id: string }>(list: ReadonlyArray<C>): ReadonlyArray<C> {
  const seen = new Set<string>();
  const out: C[] = [];
  for (const c of list) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

/**
 * Hydrate a persisted agent turn (already full) into live-UI state.
 * Used when loading /ask/[threadId] from GET /thread/:id which returns
 * full turns with all events already applied.
 */
export function hydrateStoredAgentTurn(turn: StoredTurn): AgentTurnState {
  let state = emptyAgentTurn(turn.turnId);
  for (const event of turn.events) {
    state = applyEvent(state, event);
  }
  // If the stored turn carries citations/artifacts outside the event
  // log (e.g. server persisted aggregated lists), merge them in too.
  const extraCitations = turn.citations.filter(
    (c) => !state.citations.some((existing) => existing.id === c.id),
  );
  const extraArtifacts = turn.artifacts.filter(
    (a) => !state.artifacts.some((existing) => existing.id === a.id),
  );
  // Stored turns that never reached 'done' should still render as done
  // when we reload them.
  const status = state.status === 'streaming' ? 'done' : state.status;
  // If the stored content is non-empty and we have no text, prefer it.
  const text = state.text.length > 0 ? state.text : turn.content;
  return {
    ...state,
    status,
    text,
    citations: [...state.citations, ...extraCitations],
    artifacts: [...state.artifacts, ...extraArtifacts],
  };
}
