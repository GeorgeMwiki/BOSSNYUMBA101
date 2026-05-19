/**
 * `@bossnyumba/chat-workspace` — Phase J9 core.
 *
 * Owner-facing chat-as-workspace. This package ships four modules:
 *
 *   1. `timeline/`      — `<ChatTimeline>` renders mixed prose + ag-ui
 *                          blocks as a continuous, scannable stream.
 *   2. `blocks` (types) — sum type `Turn { role, timestamp, blocks }`
 *                          with `Block = text | genui | reference | thinking`.
 *   3. `interactions/`  — `BlackboardInteractionEvent` protocol + a
 *                          thin dispatcher / collector / fan-out sink.
 *                          Compatible with K-G's interactivity shape;
 *                          types are kept inline here as
 *                          `BlackboardInteractionEvent` and will be
 *                          reconciled when K-G's PR lands.
 *   4. `persistence/`   — `EntityStorePort` against J1's entity-store
 *                          (PR #106) + a `createInMemoryEntityStore`
 *                          adapter + `replayConversation` round-trip.
 *
 * Deferred to follow-up PRs:
 *   - Blackboard panel (pin-to-side)
 *   - Voice in/out
 *   - Cross-reference scroll-to widgets
 *   - Storybook scenarios
 *
 * LITFIN: BOSSNYUMBA-only. No shared types with the LITFIN tree.
 */

export type {
  Block,
  BlockKind,
  BlockId,
  ConversationId,
  ConversationRole,
  GenUiBlock,
  Iso8601,
  PinnedBlackboardItem,
  Provenance,
  ReferenceBlock,
  TextBlock,
  ThinkingBlock,
  Turn,
  TurnId,
  VoiceBlock,
  BlackboardInteractionEvent,
  BlackboardInteractionKind,
  BlackboardInteractionPayload,
  BlackboardStreamSink,
  InteractionContext,
} from './types';

export {
  ChatTimeline,
  COLLAPSE_BREAKPOINT_PX,
  collectRefTargets,
  parseMarkdownParagraphs,
  shouldCollapseOnNarrow,
  summarisePart,
  type ChatTimelineProps,
  type GenUiSlotProps,
  type MdParagraph,
  type MdSegment,
} from './timeline';

export {
  cellEdited,
  chartFilterApplied,
  chartZoom,
  createCollectorSink,
  fanOut,
  nextEventId,
  nodeEdited,
  polygonDrawn,
  rowApproved,
  rowRejected,
  selectionChanged,
  type CollectorSink,
} from './interactions';

export {
  createInMemoryEntityStore,
  replayConversation,
  type EntityRecord,
  type EntityStorePort,
  type EntityType,
  type ReplaySnapshot,
  type SearchHit,
  type SearchQuery,
} from './persistence';
