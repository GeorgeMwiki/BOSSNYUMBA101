/**
 * Phase J9 (core) — Chat-as-Workspace — types.
 *
 * The conversation timeline is a continuous stream of {@link Turn}s,
 * each carrying a list of {@link Block}s (sum type: markdown prose,
 * inline genui part, cross-reference, voice clip, MD-thinking
 * summary). Coordination: J3 hosts the timeline in a section; J6
 * threads the conversation-id through every event; J8's streaming
 * client receives every {@link BlackboardInteractionEvent} so MD can
 * react. LITFIN: BOSSNYUMBA-only, no shared types with the LITFIN tree.
 */

import type { AgUiUiPart } from '@bossnyumba/genui';

// ─────────────────────────────────────────────────────────────────────
// Roles + identifiers
// ─────────────────────────────────────────────────────────────────────

export type ConversationRole = 'owner' | 'md' | 'internal-admin';

export type Iso8601 = string;

export interface ConversationId {
  readonly value: string;
}

export interface TurnId {
  readonly value: string;
}

export interface BlockId {
  readonly value: string;
}

// ─────────────────────────────────────────────────────────────────────
// Blocks — the sum type for what can sit inline in the conversation
// ─────────────────────────────────────────────────────────────────────

export interface TextBlock {
  readonly kind: 'text';
  readonly id: string;
  readonly markdown: string;
}

export interface GenUiBlock {
  readonly kind: 'genui';
  readonly id: string;
  readonly part: AgUiUiPart;
  /** Optional anchor label — used by `[ref:...]` tokens. */
  readonly anchor?: string;
}

export interface ReferenceBlock {
  readonly kind: 'reference';
  readonly id: string;
  /** The `id` of the {@link Block} this reference points to. */
  readonly refToBlockId: string;
  /** Short prose shown next to the link, e.g. "the cashflow chart above". */
  readonly label: string;
}

export interface VoiceBlock {
  readonly kind: 'voice';
  readonly id: string;
  /** Opaque audio source — usually a blob URL or signed CDN URL. */
  readonly audio: {
    readonly url: string;
    readonly mimeType: string;
    readonly durationMs: number;
  };
  /** Optional transcript when MD has STT'd the clip already. */
  readonly transcript?: string;
}

export interface ThinkingBlock {
  readonly kind: 'thinking';
  readonly id: string;
  /** Short MD-self-narrated rationale, shown collapsed by default. */
  readonly summary: string;
}

export type Block =
  | TextBlock
  | GenUiBlock
  | ReferenceBlock
  | VoiceBlock
  | ThinkingBlock;

export type BlockKind = Block['kind'];

// ─────────────────────────────────────────────────────────────────────
// Turn — atomic unit of conversation
// ─────────────────────────────────────────────────────────────────────

export interface Turn {
  readonly id: string;
  readonly role: ConversationRole;
  readonly timestamp: Iso8601;
  readonly blocks: ReadonlyArray<Block>;
}

// ─────────────────────────────────────────────────────────────────────
// Pinned blackboard item — survives session restart, syncs across
// devices via J1's entity-store (entity-type:
// `pinned_blackboard_item`).
// ─────────────────────────────────────────────────────────────────────

export interface PinnedBlackboardItem {
  readonly id: string;
  readonly conversationId: string;
  readonly sourceTurnId: string;
  readonly sourceBlockId: string;
  readonly part: AgUiUiPart;
  readonly pinnedAt: Iso8601;
  readonly pinnedBy: ConversationRole;
  /** Free-form note from the owner. */
  readonly note?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Interactions — what the owner can do TO an inline block, and the
// event the MD orchestrator receives via J8's streaming-client.
// ─────────────────────────────────────────────────────────────────────

export type BlackboardInteractionKind =
  | 'cell-edited'
  | 'node-edited'
  | 'polygon-drawn'
  | 'row-approved'
  | 'row-rejected'
  | 'selection-changed'
  | 'chart-zoom'
  | 'chart-filter-applied';

export interface InteractionContext {
  readonly conversationId: string;
  readonly turnId: string;
  readonly blockId: string;
  /** Original ag-ui part kind that produced the block. */
  readonly originatingPartKind: AgUiUiPart['kind'];
  /** J3 section-id when the timeline is embedded in a dynamic section. */
  readonly sectionId?: string;
}

interface CellEditedPayload {
  readonly kind: 'cell-edited';
  readonly rowKey: string;
  readonly columnId: string;
  readonly previousValue: unknown;
  readonly nextValue: unknown;
}

interface NodeEditedPayload {
  readonly kind: 'node-edited';
  readonly nodeId: string;
  readonly previousLabel?: string;
  readonly nextLabel?: string;
  readonly addedEdges?: ReadonlyArray<{ readonly from: string; readonly to: string }>;
  readonly removedEdges?: ReadonlyArray<{ readonly from: string; readonly to: string }>;
}

interface PolygonDrawnPayload {
  readonly kind: 'polygon-drawn';
  /** GeoJSON-compatible coordinate ring (longitude, latitude). */
  readonly ring: ReadonlyArray<readonly [number, number]>;
  readonly closed: boolean;
}

interface RowApprovedPayload {
  readonly kind: 'row-approved';
  readonly rowKey: string;
  readonly approvedBy: ConversationRole;
}

interface RowRejectedPayload {
  readonly kind: 'row-rejected';
  readonly rowKey: string;
  readonly reason?: string;
}

interface SelectionChangedPayload {
  readonly kind: 'selection-changed';
  readonly selectedKeys: ReadonlyArray<string>;
}

interface ChartZoomPayload {
  readonly kind: 'chart-zoom';
  readonly domainX?: readonly [number | string, number | string];
  readonly domainY?: readonly [number, number];
}

interface ChartFilterAppliedPayload {
  readonly kind: 'chart-filter-applied';
  readonly field: string;
  readonly operator: 'eq' | 'in' | 'between' | 'gt' | 'lt';
  readonly value: unknown;
}

export type BlackboardInteractionPayload =
  | CellEditedPayload
  | NodeEditedPayload
  | PolygonDrawnPayload
  | RowApprovedPayload
  | RowRejectedPayload
  | SelectionChangedPayload
  | ChartZoomPayload
  | ChartFilterAppliedPayload;

export interface BlackboardInteractionEvent {
  readonly id: string;
  readonly type: 'blackboard.interaction';
  readonly occurredAt: Iso8601;
  readonly actor: ConversationRole;
  readonly context: InteractionContext;
  readonly payload: BlackboardInteractionPayload;
}

// ─────────────────────────────────────────────────────────────────────
// Provenance — every Turn/Block/Interaction lands in J1's
// entity-store with this shape.
// ─────────────────────────────────────────────────────────────────────

export interface Provenance {
  readonly conversationId: string;
  readonly turnId: string;
  readonly blockId: string;
  readonly originatingPartKind?: AgUiUiPart['kind'];
  readonly llmInferred: boolean;
  readonly ownerCorrected: boolean;
  readonly timestamp: Iso8601;
}

// ─────────────────────────────────────────────────────────────────────
// Streaming sink — what the consumer wires to J8's streaming-client.
// ─────────────────────────────────────────────────────────────────────

export interface BlackboardStreamSink {
  readonly emit: (event: BlackboardInteractionEvent) => void | Promise<void>;
}
