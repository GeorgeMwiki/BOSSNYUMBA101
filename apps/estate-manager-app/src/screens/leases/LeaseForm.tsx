'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export function LeaseForm() {
  return (
    <LiveDataRequiredPage
      title="Create Lease"
      feature="lease authoring data"
      description="Mock units and customers have been removed. Lease creation now requires live unit inventory and customer records."
      showBack
    />
  );
}
