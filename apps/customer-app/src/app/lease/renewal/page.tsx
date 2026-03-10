'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function LeaseRenewalPage() {
  return (
    <LiveDataRequiredScreen
      title="Lease Renewal"
      feature="lease renewal data"
      description="Fallback renewal offers have been removed. This page now requires live renewal pricing and offer data."
      showBack
    />
  );
}
