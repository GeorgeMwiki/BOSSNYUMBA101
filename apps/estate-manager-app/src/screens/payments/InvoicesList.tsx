'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export function InvoicesList() {
  const t = useTranslations('simple');
  return (
    <LiveDataRequiredPage
      title={t('invoices')}
      feature="invoice list data"
      description="Fallback invoices have been removed. This list now requires the live invoicing backend."
    />
  );
}
