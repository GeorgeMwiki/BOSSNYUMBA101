'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function BankTransferPage() {
  return (
    <LiveDataRequiredScreen
      title="Bank Transfer"
      feature="Bank transfer payment instructions"
      description="The static bank account list and generated payment references have been removed. This flow requires a live payment configuration service and issued transfer instructions."
      showBack
    />
  );
}
