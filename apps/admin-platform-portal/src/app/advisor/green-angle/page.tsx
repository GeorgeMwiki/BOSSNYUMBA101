import { PortalShell } from '../_lib/PortalShell';
import { GreenAngleAdvisorClient } from './GreenAngleAdvisorClient';

export const metadata = {
  title: 'Green-angle advisor — BossNyumba HQ',
};

export default function GreenAngleAdvisorPage() {
  return (
    <PortalShell
      title="Green-angle advisor"
      description="Free-text project description → ranked green opportunities + financing instrument matches + carbon-credit methodologies + SDG alignment radar."
    >
      <GreenAngleAdvisorClient />
    </PortalShell>
  );
}
