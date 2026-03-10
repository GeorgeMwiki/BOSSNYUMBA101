'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function OccupancyPage() {
  return (
    <LiveDataRequiredPage
      title="Occupancy"
      feature="occupancy data"
      description="Static properties, units, and tenant occupancy states have been removed. This page requires live property, unit, lease, and tenant records."
    />
  );
}
