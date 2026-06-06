/**
 * BossnyumbaAIProvider — single source of truth for all chat UI.
 *
 * Mounted at the root of each portal app. Page-level surfaces
 * (ManagerChat, OwnerAdvisor …) read from the same context so the floating
 * widget and the full-page chat share a conversation.
 */
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Language } from '../chat-modes/types';
import {
  DEFAULT_WIDGET_STRINGS_EN,
  DEFAULT_WIDGET_STRINGS_SW,
  type PersonaId,
  type PortalId,
  type UnifiedChat,
  type WidgetStrings,
} from './types';
import { buildRouteContext } from './route-context';
import { useUnifiedChat } from './useUnifiedChat';
import { useWidgetLanguage } from './useWidgetLanguage';
import type { ChatStreamEvent } from '../hooks/useChatStream';

interface BossnyumbaAIContextValue {
  readonly chat: UnifiedChat;
  readonly strings: WidgetStrings;
  readonly featureEnabled: boolean;
}

const BossnyumbaAIContext = createContext<BossnyumbaAIContextValue | null>(null);

export interface BossnyumbaAIProviderProps {
  readonly children: ReactNode;
  readonly portal: PortalId;
  readonly defaultPersona: PersonaId;
  readonly defaultLanguage?: Language;
  readonly currentPath?: string;
  readonly tenantId?: string | null;
  readonly featureEnabled?: boolean;
  readonly endpoint?: string;
  /**
   * Resolves the gateway bearer token (the host app's Supabase access token)
   * at send-time. Without it the floating widget's SSE POST is unauthenticated
   * and the gateway answers 401. Each portal app passes its own
   * `getAccessToken` from `@/lib/supabase`.
   */
  readonly getAuthToken?: () => Promise<string | null> | string | null;
  readonly strings?: {
    readonly en?: Partial<WidgetStrings>;
    readonly sw?: Partial<WidgetStrings>;
  };
  /**
   * Optional tap into the raw SSE event stream. Fires for every parsed
   * frame (delta / tool_call / tab_spawn / spawn_tabs / turn_end …) so
   * surfaces can subscribe to brain side-effects (e.g. the owner-portal
   * tab store pipes this through `handleTabSseFrame` to spawn or augment
   * tabs from chat-driven conversation).
   *
   * The chat-ui widget itself does NOT consume tab events — this prop
   * keeps the chat surface domain-agnostic.
   */
  readonly onChatEvent?: (event: ChatStreamEvent) => void;
}

export function BossnyumbaAIProvider({
  children,
  portal,
  defaultPersona,
  defaultLanguage = 'en',
  currentPath = '/',
  tenantId = null,
  featureEnabled = true,
  endpoint,
  getAuthToken,
  strings,
  onChatEvent,
}: BossnyumbaAIProviderProps): JSX.Element {
  const { language, setLanguage } = useWidgetLanguage(defaultLanguage);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [soundsEnabled, setSoundsEnabled] = useState(false);

  const route = useMemo(() => buildRouteContext(currentPath, portal), [currentPath, portal]);

  const chat = useUnifiedChat({
    endpoint,
    getAuthToken,
    persona: defaultPersona,
    tenantId,
    language,
    setLanguage,
    route,
    soundsEnabled,
    setSoundsEnabled,
    voiceEnabled,
    setVoiceEnabled,
    onChatEvent,
  });

  const mergedStrings = useMemo<WidgetStrings>(() => {
    const base = language === 'sw' ? DEFAULT_WIDGET_STRINGS_SW : DEFAULT_WIDGET_STRINGS_EN;
    const override = language === 'sw' ? strings?.sw : strings?.en;
    return { ...base, ...(override ?? {}) };
  }, [language, strings]);

  const value = useMemo<BossnyumbaAIContextValue>(
    () => ({ chat, strings: mergedStrings, featureEnabled }),
    [chat, mergedStrings, featureEnabled],
  );

  return <BossnyumbaAIContext.Provider value={value}>{children}</BossnyumbaAIContext.Provider>;
}

export function useBossnyumbaAI(): BossnyumbaAIContextValue {
  const ctx = useContext(BossnyumbaAIContext);
  if (!ctx) {
    throw new Error('useBossnyumbaAI must be used inside BossnyumbaAIProvider');
  }
  return ctx;
}

export function useOptionalBossnyumbaAI(): BossnyumbaAIContextValue | null {
  return useContext(BossnyumbaAIContext);
}
