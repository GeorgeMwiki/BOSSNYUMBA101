'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function ScheduledReportsPage() {
  return (
    <LiveDataRequiredPage
      title="Scheduled Reports"
      feature="scheduled report data"
      description="Sample scheduled reports have been removed. Requires a live scheduled-reports backend."
      showBack
    />
  );
}
