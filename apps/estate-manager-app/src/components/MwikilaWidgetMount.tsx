'use client';

/**
 * MwikilaWidgetMount — estate-manager-app flavour.
 * Coworker persona; auto-flexes maintenance/leasing/finance sub-personas
 * depending on route.
 */
import { usePathname } from 'next/navigation';
import { BossnyumbaAIProvider, FloatingChatWidget } from '@bossnyumba/chat-ui';
import { useAuth } from '@/providers/AuthProvider';

interface MwikilaWidgetMountProps {
  readonly children: React.ReactNode;
}

export function MwikilaWidgetMount({ children }: MwikilaWidgetMountProps): JSX.Element {
  const pathname = usePathname() ?? '/';
  const auth = useAuth();
  const tenantId = auth.tenant?.id ?? null;

  return (
    <BossnyumbaAIProvider
      portal="estate-manager"
      defaultPersona="coworker"
      currentPath={pathname}
      tenantId={tenantId}
      featureEnabled={true}
    >
      {children}
      <FloatingChatWidget />
    </BossnyumbaAIProvider>
  );
}
