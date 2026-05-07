'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function TendersPage() {
  const t = useTranslations('misc');
  return (
    <LiveDataRequiredPage
      title={t('tenders')}
      feature="tenders"
      description="The previous page called /api/tenders, which does not exist. Wire to /api/v1/tenders on the gateway before re-enabling."
    />
  );
}
