import { PortalShell } from '../_lib/PortalShell';
import { EstateDepartmentAdvisorClient } from './EstateDepartmentAdvisorClient';

export const metadata = {
  title: 'Estate-department health — BossNyumba HQ',
};

export default function EstateDepartmentAdvisorPage() {
  return (
    <PortalShell
      title="Estate-department health"
      description="Portfolio + ops + staffing + vendor + risk + regulatory + owner-relations sections with the top-N veteran-director recommendations."
    >
      <EstateDepartmentAdvisorClient />
    </PortalShell>
  );
}
