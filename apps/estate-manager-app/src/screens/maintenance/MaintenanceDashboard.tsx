'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function MaintenanceDashboard() {
  return (
    <LiveDataRequiredPage
      title="Maintenance Dashboard"
      feature="maintenance dashboard telemetry"
      description="Fallback SLA summaries, category counts, and vendor scorecards have been removed. This dashboard now requires live maintenance analytics."
    />
  );
}
