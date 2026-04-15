'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function UtilityBillsPage() {
  return (
    <LiveDataRequiredPage
      title="Utility Bills"
      feature="utility bills"
      description="Mock bill data has been removed. Requires the live billing service."
      showBack
    />
  );
}
