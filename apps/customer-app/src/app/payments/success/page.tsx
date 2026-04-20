'use client';

import { useEffect, useState } from 'react';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';
import { Dopamine } from '@bossnyumba/chat-ui';

const { ConfettiTrigger } = Dopamine;

interface PaymentSuccessRecord {
  readonly tenantId: string;
  readonly userId: string;
  readonly receiptNumber: string;
}

async function loadSuccess(): Promise<PaymentSuccessRecord | null> {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const receipt = params.get('receipt');
  if (!receipt) return null;
  try {
    const res = await fetch(`/api/v1/payments/receipts/${encodeURIComponent(receipt)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as PaymentSuccessRecord;
  } catch {
    return null;
  }
}

export default function PaymentSuccessPage() {
  const [record, setRecord] = useState<PaymentSuccessRecord | null>(null);

  useEffect(() => {
    loadSuccess().then(setRecord);
  }, []);

  return (
    <>
      {record ? (
        <ConfettiTrigger
          active={true}
          kind="tenant-on-time-payment"
          tenantId={record.tenantId}
          userId={record.userId}
        />
      ) : null}
      <LiveDataRequiredScreen
        title="Payment Receipt"
        feature="Payment receipt"
        description="This page requires a live confirmed payment record from the backend. When a real receipt is provided via the receipt query parameter, an on-time-payment celebration is shown."
        showBack
      />
    </>
  );
}
