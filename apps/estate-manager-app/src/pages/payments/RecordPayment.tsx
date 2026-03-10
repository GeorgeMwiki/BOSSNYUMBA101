'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export function RecordPayment() {
  return (
    <LiveDataRequiredPage
      title="Record Payment"
      feature="payment recording"
      description="Mock leases and invoices have been removed. This action now requires live lease, invoice, and payment-ledger data."
      showBack
    />
  );
}
