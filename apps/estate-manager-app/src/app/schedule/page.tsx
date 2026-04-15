'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function SchedulePage() {
  return (
    <LiveDataRequiredPage
      title="Schedule"
      feature="technician schedule"
      description="Hardcoded daily schedule data has been removed. Requires live work-order and inspection schedule feeds."
    />
  );
}
