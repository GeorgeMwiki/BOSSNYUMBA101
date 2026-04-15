'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function UtilitiesPage() {
  return (
    <LiveDataRequiredPage
      title="Utilities"
      feature="utilities telemetry"
      description="Sample utility summaries have been removed. Requires live meter and billing data."
    />
  );
}
