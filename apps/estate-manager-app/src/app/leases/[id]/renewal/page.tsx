'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function LeaseRenewalPage() {
  const t = useTranslations('leaseRenewal');
  const params = useParams();
  const id = (params?.id as string) ?? '';
  return (
    <LiveDataRequiredPage
      title={t('title', { id })}
      feature="lease renewal proposal"
      description="The previous page called /api/leases/{id}/renewal, which does not exist. Wire to /api/v1/renewals on the gateway before re-enabling."
      showBack
    />
  );
}
