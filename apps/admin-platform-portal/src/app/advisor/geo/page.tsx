import { PortalShell } from '../_lib/PortalShell';
import { GeoAdvisorMount } from './GeoAdvisorMount';

export const metadata = {
  title: 'Geo advisor — BossNyumba HQ',
};

export default function GeoAdvisorPage() {
  return (
    <PortalShell
      title="Geo advisor"
      description="Live parcel map with painted parcels + an area-insights side panel covering solar potential, air quality, and drive-time."
    >
      <GeoAdvisorMount />
    </PortalShell>
  );
}
