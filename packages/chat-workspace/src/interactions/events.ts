/**
 * Interaction event builders.
 *
 * Each helper returns a fully-formed {@link BlackboardInteractionEvent}
 * that the consumer can pipe into J8's streaming-client. We keep the
 * builders here so the React components stay declarative and the
 * payload shapes are exhaustively typed in one place.
 */

import type {
  BlackboardInteractionEvent,
  BlackboardInteractionPayload,
  ConversationRole,
  InteractionContext,
} from '../types';

interface BuildArgs {
  readonly actor: ConversationRole;
  readonly context: InteractionContext;
  readonly id?: string;
  readonly occurredAt?: string;
}

let counter = 0;

/** Deterministic-ish event id; consumers can override. */
export function nextEventId(): string {
  counter += 1;
  return `evt-${Date.now().toString(36)}-${counter.toString(36)}`;
}

function buildEvent(
  args: BuildArgs,
  payload: BlackboardInteractionPayload,
): BlackboardInteractionEvent {
  return {
    id: args.id ?? nextEventId(),
    type: 'blackboard.interaction',
    actor: args.actor,
    context: args.context,
    occurredAt: args.occurredAt ?? new Date().toISOString(),
    payload,
  };
}

export function cellEdited(
  args: BuildArgs,
  payload: {
    readonly rowKey: string;
    readonly columnId: string;
    readonly previousValue: unknown;
    readonly nextValue: unknown;
  },
): BlackboardInteractionEvent {
  return buildEvent(args, { kind: 'cell-edited', ...payload });
}

export function nodeEdited(
  args: BuildArgs,
  payload: {
    readonly nodeId: string;
    readonly previousLabel?: string;
    readonly nextLabel?: string;
    readonly addedEdges?: ReadonlyArray<{ readonly from: string; readonly to: string }>;
    readonly removedEdges?: ReadonlyArray<{ readonly from: string; readonly to: string }>;
  },
): BlackboardInteractionEvent {
  return buildEvent(args, { kind: 'node-edited', ...payload });
}

export function polygonDrawn(
  args: BuildArgs,
  payload: {
    readonly ring: ReadonlyArray<readonly [number, number]>;
    readonly closed: boolean;
  },
): BlackboardInteractionEvent {
  return buildEvent(args, { kind: 'polygon-drawn', ...payload });
}

export function rowApproved(
  args: BuildArgs,
  payload: {
    readonly rowKey: string;
    readonly approvedBy: ConversationRole;
  },
): BlackboardInteractionEvent {
  return buildEvent(args, { kind: 'row-approved', ...payload });
}

export function rowRejected(
  args: BuildArgs,
  payload: {
    readonly rowKey: string;
    readonly reason?: string;
  },
): BlackboardInteractionEvent {
  return buildEvent(args, { kind: 'row-rejected', ...payload });
}

export function selectionChanged(
  args: BuildArgs,
  payload: { readonly selectedKeys: ReadonlyArray<string> },
): BlackboardInteractionEvent {
  return buildEvent(args, { kind: 'selection-changed', ...payload });
}

export function chartZoom(
  args: BuildArgs,
  payload: {
    readonly domainX?: readonly [number | string, number | string];
    readonly domainY?: readonly [number, number];
  },
): BlackboardInteractionEvent {
  return buildEvent(args, { kind: 'chart-zoom', ...payload });
}

export function chartFilterApplied(
  args: BuildArgs,
  payload: {
    readonly field: string;
    readonly operator: 'eq' | 'in' | 'between' | 'gt' | 'lt';
    readonly value: unknown;
  },
): BlackboardInteractionEvent {
  return buildEvent(args, { kind: 'chart-filter-applied', ...payload });
}
