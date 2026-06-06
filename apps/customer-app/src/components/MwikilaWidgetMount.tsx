'use client';

/**
 * MwikilaWidgetMount — customer-app flavour of the unified Mr. Mwikila
 * floating chat widget. Reads the current pathname so the sub-persona
 * router wakes up the right "muscle" for whatever page the tenant is on.
 * Feature-flag gated: the widget hides entirely when `featureEnabled`
 * is false (sourced from the feature-flags service in future waves).
 *
 * SOTA lazy-load — the floating chat widget bundle is loaded via
 * `next/dynamic({ ssr: false })` so the heavy widget never enters the
 * SSR module graph. Cuts SSR JS payload + parse time and guarantees no
 * future window-touching transitive dep can ever crash boot. The
 * `BossnyumbaAIProvider` stays in the server graph because it only
 * provides context — the visible/interactive widget is what we defer.
 */
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { BossnyumbaAIProvider } from '@bossnyumba/chat-ui';
import { useAuth } from '@/contexts/AuthContext';
import { getAccessToken } from '@/lib/supabase';

const FloatingChatWidget = dynamic(
  () => import('@bossnyumba/chat-ui').then((m) => m.FloatingChatWidget),
  { ssr: false },
);

interface MwikilaWidgetMountProps {
  readonly children: React.ReactNode;
}

export function MwikilaWidgetMount({ children }: MwikilaWidgetMountProps): JSX.Element {
  const pathname = usePathname() ?? '/';
  const auth = useAuth();
  const tenantId = auth.user?.activeOrgId ?? null;
  const featureEnabled = true;

  return (
    <BossnyumbaAIProvider
      portal="customer"
      defaultPersona="tenant-assistant"
      currentPath={pathname}
      tenantId={tenantId}
      getAuthToken={getAccessToken}
      featureEnabled={featureEnabled}
    >
      {children}
      <FloatingChatWidget />
    </BossnyumbaAIProvider>
  );
}
