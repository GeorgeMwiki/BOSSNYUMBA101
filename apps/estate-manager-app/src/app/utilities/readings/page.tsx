'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function UtilityReadingsPage() {
  return (
    <LiveDataRequiredPage
      title="Meter Readings"
      feature="meter readings"
      description="Sample readings have been removed. Requires live meter-reading ingestion."
      showBack
    />
  );
}
