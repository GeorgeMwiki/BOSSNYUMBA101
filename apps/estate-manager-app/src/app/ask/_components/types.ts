/**
 * Local types for the /ask surface.
 *
 * Mirror the shape of @bossnyumba/central-intelligence so the SSE
 * parser can hand typed events to the renderer without pulling the
 * whole package into the client bundle.
 */

export type CitationTarget =
  | { readonly kind: 'graph_node'; readonly nodeLabel: string; readonly nodeId: string }
  | { readonly kind: 'graph_edge'; readonly fromId: string; readonly edgeType: string; readonly toId: string }
  | { readonly kind: 'forecast'; readonly forecastId: string }
  | { readonly kind: 'audit_entry'; readonly entryId: string }
  | { readonly kind: 'document'; readonly documentId: string; readonly anchor?: string }
  | { readonly kind: 'conversation'; readonly threadId: string; readonly turnId: string }
  | { readonly kind: 'statute'; readonly jurisdiction: string; readonly statuteRef: string; readonly section: string }
  | { readonly kind: 'platform_aggregate'; readonly statistic: string; readonly sliceFingerprint: string };

export interface Citation {
  readonly id: string;
  readonly target: CitationTarget;
  readonly label: string;
  readonly confidence: number;
}

export type ArtifactKind =
  | 'line_chart'
  | 'bar_chart'
  | 'scrubbable_chart'
  | 'node_map'
  | 'table'
  | 'plan'
  | 'forecast_card'
  | 'cohort_breakdown';

export interface Artifact {
  readonly id: string;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly data: unknown;
  readonly citations: ReadonlyArray<Citation>;
  readonly createdAt: string;
}

export type ToolOutcome =
  | {
      readonly kind: 'ok';
      readonly ok: boolean;
      readonly output: unknown;
      readonly latencyMs: number;
      readonly citations: ReadonlyArray<Citation>;
      readonly artifact: Artifact | null;
    }
  | { readonly kind: 'error'; readonly message: string; readonly retryable: boolean };

export type AgentEvent =
  | { readonly kind: 'plan'; readonly steps: ReadonlyArray<string>; readonly at: string }
  | { readonly kind: 'thought'; readonly text: string; readonly at: string }
  | { readonly kind: 'tool_call'; readonly callId: string; readonly toolName: string; readonly input: unknown; readonly at: string }
  | { readonly kind: 'tool_result'; readonly callId: string; readonly outcome: ToolOutcome; readonly at: string }
  | { readonly kind: 'text'; readonly delta: string; readonly at: string }
  | { readonly kind: 'citation'; readonly citation: Citation; readonly at: string }
  | { readonly kind: 'artifact'; readonly artifact: Artifact; readonly at: string }
  | { readonly kind: 'error'; readonly message: string; readonly retryable: boolean; readonly at: string }
  | { readonly kind: 'done'; readonly turnId: string; readonly totalMs: number; readonly at: string };

export interface ThreadSummary {
  readonly threadId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly turnCount: number;
}

export interface StoredTurn {
  readonly turnId: string;
  readonly threadId: string;
  readonly role: 'user' | 'agent';
  readonly content: string;
  readonly events: ReadonlyArray<AgentEvent>;
  readonly citations: ReadonlyArray<Citation>;
  readonly artifacts: ReadonlyArray<Artifact>;
  readonly createdAt: string;
}

/**
 * ToolCallState — aggregates a running tool invocation for UI display.
 * Produced by folding tool_call + tool_result events keyed on callId.
 */
export interface ToolCallState {
  readonly callId: string;
  readonly toolName: string;
  readonly status: 'running' | 'done' | 'failed';
  readonly errorMessage?: string;
  readonly latencyMs?: number;
}

/**
 * AgentTurnState — the live fold of a single agent turn's events.
 * Mutates immutably as each event arrives via SSE.
 */
export interface AgentTurnState {
  readonly turnId: string;
  readonly status: 'streaming' | 'done' | 'error';
  readonly plan: ReadonlyArray<string> | null;
  readonly thoughts: ReadonlyArray<string>;
  readonly toolCalls: ReadonlyArray<ToolCallState>;
  readonly text: string;
  readonly citations: ReadonlyArray<Citation>;
  readonly artifacts: ReadonlyArray<Artifact>;
  readonly error: string | null;
  readonly totalMs: number | null;
}

export interface UserTurnState {
  readonly turnId: string;
  readonly content: string;
}

export type TurnState =
  | { readonly role: 'user'; readonly turn: UserTurnState }
  | { readonly role: 'agent'; readonly turn: AgentTurnState };

export type DegradedReason = 'network' | 'unavailable' | 'unauthorized' | 'forbidden' | 'unknown';

export interface DegradedState {
  readonly reason: DegradedReason;
  readonly message: string;
  readonly status: number;
}
