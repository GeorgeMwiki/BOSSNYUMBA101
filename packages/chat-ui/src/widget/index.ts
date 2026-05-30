export * from './types';
export * from './route-context';
export { useUnifiedChat, buildAttachment } from './useUnifiedChat';
export type { UseUnifiedChatOptions } from './useUnifiedChat';
export { useWidgetLanguage } from './useWidgetLanguage';
export type { UseWidgetLanguageResult } from './useWidgetLanguage';
export { useChatSounds } from './useChatSounds';
export type { ChatSoundKind, UseChatSoundsResult } from './useChatSounds';
export {
  BossnyumbaAIProvider,
  useBossnyumbaAI,
  useOptionalBossnyumbaAI,
} from './BossnyumbaAIProvider';
export type { BossnyumbaAIProviderProps } from './BossnyumbaAIProvider';
export { ChatPanel } from './ChatPanel';
export { MessageBubble } from './MessageBubble';
export { ContextBadge } from './ContextBadge';
export { SegmentHeader } from './SegmentHeader';
export { WaveformVisualizer } from './WaveformVisualizer';
export { VoiceOverlay } from './VoiceOverlay';
export { FloatingChatWidget } from './FloatingChatWidget';
export { renderMarkdown, escapeHtml } from './markdown';

// ---------------------------------------------------------------------------
// LitFin-style carbon-copy widget — identical FAB + ChatPanel visual
// shell ported from LitFin. Coexists with the legacy
// `FloatingChatWidget` above; new mounts should prefer `LitFinWidget`
// behind `LitFinAIProvider`.
// ---------------------------------------------------------------------------
export { LitFinWidget } from './LitFinWidget';
export { LitFinChatPanel } from './LitFinChatPanel';
export {
  LitFinAIProvider,
  useLitFinAI,
  useOptionalLitFinAI,
} from './LitFinAIProvider';
export type {
  LitFinAIProviderProps,
  LitFinPortalId,
  LitFinPersonaId,
} from './LitFinAIProvider';
export { LitFinMessageBubble } from './LitFinMessageBubble';
export type { LitFinMessage } from './LitFinMessageBubble';
export { LitFinContextBadge } from './LitFinContextBadge';
export { LitFinSegmentHeader } from './LitFinSegmentHeader';
export { LitFinErrorBoundary } from './LitFinErrorBoundary';
export { AIMessageText } from './AIMessageText';
export {
  getWidgetWelcomeMessage,
  getWidgetSuggestionChips,
} from './litfin-widget-content';
export type {
  WidgetLanguage as LitFinWidgetLanguage,
  WidgetPortalId as LitFinWidgetPortalId,
  WidgetSuggestionChip as LitFinWidgetSuggestionChip,
} from './litfin-widget-content';
