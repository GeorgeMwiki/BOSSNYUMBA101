'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function WorkOrderForm() {
  return (
    <LiveDataRequiredPage
      title="Create Work Order"
      feature="work-order authoring data"
      description="Mock properties and units have been removed. Work-order creation now requires live property, unit, and workflow data."
      showBack
    />
  );
}
