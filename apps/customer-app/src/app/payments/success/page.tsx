'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function PaymentSuccessPage() {
  return (
    <LiveDataRequiredScreen
      title="Payment Receipt"
      feature="Payment receipt"
      description="The synthetic success receipt, generated reference, and celebratory simulation have been removed. This page requires a live confirmed payment record from the backend."
      showBack
    />
  );
}
