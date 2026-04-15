'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function ReceivePaymentPage() {
  return (
    <LiveDataRequiredPage
      title="Receive Payment"
      feature="payment receipt capture"
      description="Manual payment capture requires live lease, invoice, and ledger services."
      showBack
    />
  );
}
