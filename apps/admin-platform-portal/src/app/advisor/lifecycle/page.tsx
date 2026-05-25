import { PortalShell } from '../_lib/PortalShell';
import { LifecycleAdvisorClient } from './LifecycleAdvisorClient';

export const metadata = {
  title: 'Lifecycle advisor — BossNyumba HQ',
};

export default function LifecycleAdvisorPage() {
  return (
    <PortalShell
      title="Lifecycle advisor"
      description="Pick an asset + lifecycle stage and the advisor returns the next-best action ranked by priority and confidence, with citations and alternatives."
    >
      <LifecycleAdvisorClient />
    </PortalShell>
  );
}
