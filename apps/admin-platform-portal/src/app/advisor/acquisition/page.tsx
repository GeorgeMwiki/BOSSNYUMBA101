import { PortalShell } from '../_lib/PortalShell';
import { AcquisitionAdvisorClient } from './AcquisitionAdvisorClient';

export const metadata = {
  title: 'Acquisition advisor — BossNyumba HQ',
};

export default function AcquisitionAdvisorPage() {
  return (
    <PortalShell
      title="Acquisition advisor"
      description="Triangulated pricing + DD findings + closing checklist for a deal under consideration. Composite verdict over financial, comps, environmental, title, survey, zoning, geotech, financial DD, and EA-jurisdictional axes."
    >
      <AcquisitionAdvisorClient />
    </PortalShell>
  );
}
