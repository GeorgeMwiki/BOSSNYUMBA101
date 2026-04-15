'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function AvailabilityPage() {
  return (
    <LiveDataRequiredPage
      title="Availability"
      feature="availability configuration"
      description="Default availability mock data has been removed. Requires a live availability service before edits can be persisted."
      showBack
    />
  );
}
