/**
 * MwikilaWidgetMount — owner-portal flavour.
 * Owner-advisor persona; flexes portfolio, finance, compliance sub-personas.
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
  const tenantId = auth.tenant?.id ?? null;

  return (
    <BossnyumbaAIProvider
      portal="owner"
      defaultPersona="owner-advisor"
      currentPath={location.pathname}
      tenantId={tenantId}
      featureEnabled={true}
    >
      {children}
      <FloatingChatWidget />
    </BossnyumbaAIProvider>
  );
}
