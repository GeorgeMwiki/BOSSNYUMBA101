'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function WorkOrdersPage() {
  return (
    <LiveDataRequiredPage
      title="Work Orders"
      feature="work-order operations"
      description="Mock work orders, assignments, and approvals have been removed. This screen now requires live work-order, vendor, and approval data."
    />
  );
}
