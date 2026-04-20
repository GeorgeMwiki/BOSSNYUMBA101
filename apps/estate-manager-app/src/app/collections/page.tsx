'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function CollectionsPage() {
  const t = useTranslations('simple');
  return (
    <LiveDataRequiredPage
      title={t('collections')}
      feature="collections dashboard data"
      description="Fallback arrears queues and generated collections actions have been removed. This page now requires live collections and invoicing data."
    />
  );
}
