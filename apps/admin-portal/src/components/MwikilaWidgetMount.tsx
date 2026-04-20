/**
 * MwikilaWidgetMount — admin-portal flavour (Vite + react-router).
 * Uses react-router's useLocation so the widget follows route changes.
 */
import { useLocation } from 'react-router-dom';
import { BossnyumbaAIProvider, FloatingChatWidget } from '@bossnyumba/chat-ui';
import { useAuth } from '../contexts/AuthContext';

interface MwikilaWidgetMountProps {
  readonly children: React.ReactNode;
}

export function MwikilaWidgetMount({ children }: MwikilaWidgetMountProps): JSX.Element {
  const location = useLocation();
  const auth = useAuth();
  const tenantId = auth.user?.tenantId ?? null;

  return (
    <BossnyumbaAIProvider
      portal="admin"
      defaultPersona="manager-chat"
      currentPath={location.pathname}
      tenantId={tenantId}
      featureEnabled={true}
    >
      {children}
      <FloatingChatWidget />
    </BossnyumbaAIProvider>
  );
}
