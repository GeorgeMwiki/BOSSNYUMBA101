'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

interface PaymentDetailProps {
  paymentId: string;
}

export function PaymentDetail({ paymentId }: PaymentDetailProps) {
  return (
    <LiveDataRequiredPage
      title={`Payment ${paymentId}`}
      feature="payment detail data"
      description="Fallback payment details have been removed. This view now requires live payment-ledger data."
      showBack
    />
  );
}
