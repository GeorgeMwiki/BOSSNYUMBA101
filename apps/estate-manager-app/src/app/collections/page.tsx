'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function CollectionsPage() {
  return (
    <LiveDataRequiredPage
      title="Collections"
      feature="collections dashboard data"
      description="Fallback arrears queues and generated collections actions have been removed. This page now requires live collections and invoicing data."
    />
  );
}
