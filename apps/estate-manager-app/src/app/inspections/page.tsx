'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function InspectionsPage() {
  return (
    <LiveDataRequiredPage
      title="Inspections"
      feature="inspection list data"
      description="This page now requires live inspection data."
    />
  );
}
