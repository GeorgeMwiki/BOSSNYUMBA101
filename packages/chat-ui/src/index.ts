export * from './chat-modes';
export * from './generative-ui';
export * from './blackboard';
export * from './hooks';
export * from './widget';
export * from './voice';
// Shared brain-degraded UI marker — consumed by customer-app/brain-degraded.ts.
export { DegradedBanner } from './components/DegradedBanner';
export type { DegradedBannerProps, DegradedMarker } from './components/DegradedBanner';
// Wave-3 INT-4 — Proactive UX surfaces for the MD-vision packages.
export { ProactiveHint } from './components/ProactiveHint';
export type {
  ProactiveHintProps,
  HintCandidate,
  HintTrigger,
  HintAction,
  HintStorage,
} from './components/ProactiveHint';
export { selectHint, matchesThreshold, readDismissed } from './components/ProactiveHint';
// ChatArtifactStream + NeedSpawnBanner are surfaces consumed by the
// three frontends to render kernel-emitted artifacts + Piece O spawn
// proposals inline in the chat.
export { ChatArtifactStream } from './components/ChatArtifactStream';
export type {
  ChatArtifactStreamProps,
  ChatArtifact,
  ArtifactRenderer,
} from './components/ChatArtifactStream';
export { NeedSpawnBanner, sortProposals } from './components/NeedSpawnBanner';
export type {
  NeedSpawnBannerProps,
  TabSpawnProposal,
} from './components/NeedSpawnBanner';
// Progressive-disclosure mastery gate — UI shrinks for novices and
// expands as the user accrues actions. See lib/user-mastery/.
export { MasteryGate } from './components/MasteryGate';
export type { MasteryGateProps } from './components/MasteryGate';
export * from './lib/user-mastery/index.js';

// Superpower chips — eight families of brain-emitted action chips
// (ui_navigate / prefill / highlight / share / bulk / undo / cmdk /
// bookmark). Frontend agnostic — host app injects onNavigate +
// postJson.
export {
  SuperpowerChips,
  UndoChip,
  publishFormPrefill,
  publishHighlight,
  publishOpenCommandPalette,
  FORM_PREFILL_EVENT_NAME,
  HIGHLIGHT_EVENT_NAME,
  CMDK_OPEN_EVENT_NAME,
  uiNavigateChipSchema,
  uiPrefillChipSchema,
  uiHighlightChipSchema,
  uiShareChipSchema,
  uiBulkChipSchema,
  uiUndoChipSchema,
  uiCmdkChipSchema,
  uiBookmarkChipSchema,
} from './components/SuperpowerChips';
export type {
  SuperpowerChipsProps,
  UndoChipProps,
  UiNavigateChip,
  UiPrefillChip,
  UiHighlightChip,
  UiShareChip,
  UiBulkChip,
  UiUndoChip,
  UiCmdkChip,
  UiBookmarkChip,
} from './components/SuperpowerChips';
// Learned-shortcuts panel — per-route ranked frequent actions. Reads
// from the `user_action_tracker` table owned by UI-3's migration in
// packages/database; chat-ui only consumes denormalised rows via a
// fetcher supplied by the consuming app.
export { LearnedShortcutsPanel } from './components/LearnedShortcutsPanel.js';
export { useLearnedShortcuts } from './hooks/useLearnedShortcuts.js';
export {
  rankActions,
  scoreAction,
  recencyWeight,
  confirmationRate,
} from './lib/learned-shortcuts/index.js';
export type {
  LearnedShortcut,
  LearnedShortcutsPanelProps,
  PinnedStorage,
  RankerOptions,
  ShortcutsCacheEntry,
  UseLearnedShortcutsOptions,
  UseLearnedShortcutsResult,
  UserActionTrackerRow,
} from './lib/learned-shortcuts/index.js';
export * as Dopamine from './dopamine/index.js';
// Bilingual SSE chat hook with /api/v1/translate retranslation. Lives
// alongside the existing useChatStream / useJarvis hooks for consumers
// that need locale-toggle history retranslation against Claude Haiku.
export * from './bossnyumba/index.js';
// Canonical display identity — locked by founder directive. Every UI
// surface that renders the persona name/title must source from here so
// the string never drifts. See `./canonical-display.ts`.
export {
  MR_MWIKILA_CANONICAL_DISPLAY,
  type MrMwikilaCanonicalDisplay,
} from './canonical-display.js';

// LitFin canonical chat-UI primitives — carbon copy of LitFin's chat-ui
// (LITFIN_PATH/src/components/chat-ui/index.tsx). The visual shell every
// BossNyumba chat surface must use so the copper-on-cream brand experience
// is consistent across marketing widget, owner cockpit chat, tenant portal,
// estate-manager chat, mobile shells.
export {
  CHAT_HEADER_GRADIENT,
  CHAT_USER_BUBBLE,
  CHAT_AI_BUBBLE,
  ChatShellHeader,
  ChatHeaderIconButton,
  TypingDots,
  ChatShellEmptyState,
  ChatShellBody,
  ChatShellMessageRow,
  ChatShellComposer,
  ChatShellDisclaimer,
  ChatShell,
} from './litfin-primitives.js';
export type {
  ChatShellHeaderProps,
  ChatShellEmptyStateProps,
  ChatShellMessageRowProps,
  ChatShellComposerProps,
  ChatShellDisclaimerProps,
  ChatShellProps,
} from './litfin-primitives.js';
