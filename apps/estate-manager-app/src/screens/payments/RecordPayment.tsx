'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export function RecordPayment() {
  const t = useTranslations('simple');
  return (
    <LiveDataRequiredPage
      title={t('recordPayment')}
      feature="payment recording"
      description="Mock leases and invoices have been removed. This action now requires live lease, invoice, and payment-ledger data."
      showBack
    />
  );
}
