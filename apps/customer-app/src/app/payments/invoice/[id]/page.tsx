'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function InvoicePage() {
  return (
    <LiveDataRequiredScreen
      title="Invoice"
      feature="invoice detail"
      description="Static invoice mocks and hardcoded line items have been removed. This screen now requires live invoice data from the payments API."
      showBack
    />
  );
}
