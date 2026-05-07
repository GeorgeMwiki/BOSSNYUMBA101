'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function LeaseMoveOutPage() {
  const t = useTranslations('leaseMoveOut');
  const params = useParams();
  const id = (params?.id as string) ?? '';
  return (
    <LiveDataRequiredPage
      title={t('title', { id })}
      feature="lease move-out checklist"
      description="The previous page posted to /api/leases/{id}/move-out, which does not exist. Wire to /api/v1/move-out on the gateway before re-enabling."
      showBack
    />
  );
}
