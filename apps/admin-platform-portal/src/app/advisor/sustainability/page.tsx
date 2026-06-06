import { PortalShell } from '../_lib/PortalShell';
import { SustainabilityAdvisorMount } from './SustainabilityAdvisorMount';

export const metadata = {
  title: 'Sustainability advisor — BossNyumba HQ',
};

export default function SustainabilityAdvisorPage() {
  return (
    <PortalShell
      title="Sustainability advisor"
      description="GHG Protocol Scope 1/2/3, BREEAM/LEED/EDGE predicted rating, BNG units, and forecast carbon-credit value for a selected property."
    >
      <SustainabilityAdvisorMount />
    </PortalShell>
  );
}
