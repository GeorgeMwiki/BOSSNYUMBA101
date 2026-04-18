'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export function PaymentsList() {
  return (
    <LiveDataRequiredPage
      title="Payments"
      feature="payment list data"
      description="Fallback payment history has been removed. This list now requires live payments and settlement data."
    />
  );
}
