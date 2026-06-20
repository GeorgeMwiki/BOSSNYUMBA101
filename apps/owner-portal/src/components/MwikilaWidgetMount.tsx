/**
 * MwikilaWidgetMount — owner-portal flavour.
 * Owner-advisor persona; flexes portfolio, finance, compliance sub-personas.
 *
 * Also bridges the brain's SSE stream into the owner-portal tab store
 * via `useChatTabBridge`. When Mr. Mwikila emits `<tab_spawn>` or
 * `<spawn_tabs>` inline with a chat reply the gateway lifts those
 * tags into discrete SSE events (chat-tab-bridge.ts) which we route
 * through `handleTabSseFrame` into the tab store, opening or augmenting
 * the matching tab in the strip above the page content.
 */
import { useLocation } from 'react-router-dom';
import { BossnyumbaAIProvider, FloatingChatWidget } from '@bossnyumba/chat-ui';
import { useAuth } from '../contexts/AuthContext';
import { useChatTabBridge } from '../state/useChatTabBridge';
import { useLocaleContext } from '../contexts/LocaleProvider';

interface MwikilaWidgetMountProps {
  readonly children: React.ReactNode;
}

export function MwikilaWidgetMount({ children }: MwikilaWidgetMountProps): JSX.Element {
  const location = useLocation();
  const auth = useAuth();
  const tenantId = auth.tenant?.id ?? null;
  // Active EN/SW locale (absolute toggle). Seeds the widget's default
  // language so Swahili owners get a Swahili greeting/persona by default
  // (the widget's own in-panel toggle still wins if they flip it there),
  // and drives the tab-strip title EN/SW fallback below — previously the
  // strip showed English titles for Swahili owners.
  const { locale } = useLocaleContext();
  // The bridge is a no-op when the tabs provider isn't mounted, so we
  // can hand `onEvent` straight to the chat provider unconditionally.
  const tabBridge = useChatTabBridge({ locale });

  return (
    <BossnyumbaAIProvider
      portal="owner"
      defaultPersona="owner-advisor"
      defaultLanguage={locale}
      currentPath={location.pathname}
      tenantId={tenantId}
      featureEnabled={true}
      onChatEvent={tabBridge.onEvent}
    >
      {children}
      <FloatingChatWidget />
    </BossnyumbaAIProvider>
  );
}
