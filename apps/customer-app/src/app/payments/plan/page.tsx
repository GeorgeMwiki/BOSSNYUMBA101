'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function PaymentPlanPage() {
  return (
    <LiveDataRequiredScreen
      title="Payment Plan"
      feature="payment plan data"
      description="Local-storage payment plan fallbacks and generated timelines have been removed. This screen now requires live payment plan and balance data."
      showBack
    />
  );
}
