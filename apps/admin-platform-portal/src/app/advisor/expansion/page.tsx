import { PortalShell } from '../_lib/PortalShell';
import { ExpansionAdvisorClient } from './ExpansionAdvisorClient';

export const metadata = {
  title: 'Expansion advisor — BossNyumba HQ',
};

export default function ExpansionAdvisorPage() {
  return (
    <PortalShell
      title="Expansion advisor"
      description="HBU 4-test gate log, capital-stack visualisation, and lease-up + absorption curves for a candidate expansion parcel."
    >
      <ExpansionAdvisorClient />
    </PortalShell>
  );
}
