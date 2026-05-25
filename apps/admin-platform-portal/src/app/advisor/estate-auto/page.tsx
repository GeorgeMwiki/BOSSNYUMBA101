import { PortalShell } from '../_lib/PortalShell';
import { EstateAutoAdvisorClient } from './EstateAutoAdvisorClient';

export const metadata = {
  title: 'Estate automation — BossNyumba HQ',
};

export default function EstateAutoAdvisorPage() {
  return (
    <PortalShell
      title="Estate automation"
      description="Predictive-maintenance dashboard (asset health × probability matrix) + collection cadence + vendor scorecard for the operating estate."
    >
      <EstateAutoAdvisorClient />
    </PortalShell>
  );
}
