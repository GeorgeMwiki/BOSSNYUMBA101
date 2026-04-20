'use client';

/**
 * MwikilaWidgetMount — customer-app flavour of the unified Mr. Mwikila
 * floating chat widget. Reads the current pathname so the sub-persona
 * router wakes up the right "muscle" for whatever page the tenant is on.
 * Feature-flag gated: the widget hides entirely when `featureEnabled`
 * is false (sourced from the feature-flags service in future waves).
 */
import { usePathname } from 'next/navigation';
import { BossnyumbaAIProvider, FloatingChatWidget } from '@bossnyumba/chat-ui';
import { useAuth } from '@/contexts/AuthContext';

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
      featureEnabled={featureEnabled}
    >
      {children}
      <FloatingChatWidget />
    </BossnyumbaAIProvider>
  );
}
