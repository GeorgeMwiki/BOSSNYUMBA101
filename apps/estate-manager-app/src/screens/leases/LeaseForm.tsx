'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export function LeaseForm() {
  const t = useTranslations('simple');
  return (
    <LiveDataRequiredPage
      title={t('createLease')}
      feature="lease authoring data"
      description="Mock units and customers have been removed. Lease creation now requires live unit inventory and customer records."
      showBack
    />
  );
}
