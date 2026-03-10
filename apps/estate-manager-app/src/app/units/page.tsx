'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function UnitsPage() {
  return (
    <LiveDataRequiredPage
      title="Units"
      feature="unit inventory data"
      description="Fallback unit inventory and tenant occupancy data have been removed. This page now requires live unit, property, and lease data."
    />
  );
}
