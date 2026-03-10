'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function SLADashboardPage() {
  return (
    <LiveDataRequiredPage
      title="SLA Dashboard"
      feature="SLA telemetry"
      description="Fallback SLA metrics and health summaries have been removed. This dashboard now requires live SLA services."
    />
  );
}
