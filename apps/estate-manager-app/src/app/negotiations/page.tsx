'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function NegotiationsPage() {
  const t = useTranslations('misc');
  return (
    <LiveDataRequiredPage
      title={t('negotiations')}
      feature="rent negotiations"
      description="The previous page called /api/negotiations, which does not exist. Wire to /api/v1/negotiations on the gateway before re-enabling."
    />
  );
}
