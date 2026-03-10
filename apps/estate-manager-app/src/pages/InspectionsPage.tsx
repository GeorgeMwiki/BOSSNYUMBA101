'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function InspectionsPage() {
  return (
    <LiveDataRequiredPage
      title="Inspections"
      feature="inspection scheduling data"
      description="Mock inspections and offline inspection state have been removed. This screen now requires live inspection scheduling and execution APIs."
    />
  );
}
