'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function VendorsPage() {
  return (
    <LiveDataRequiredPage
      title="Vendors"
      feature="vendor operations data"
      description="Synthetic vendors and invoice queues have been removed. This workspace now requires live vendor, invoice, and work-order integrations."
    />
  );
}
