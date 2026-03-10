'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function MpesaPage() {
  return (
    <LiveDataRequiredScreen
      title="Pay with M-Pesa"
      feature="M-Pesa payment initiation"
      description="Simulated M-Pesa payment outcomes have been removed. This screen now requires a live payment initiation and callback flow."
      showBack
    />
  );
}
