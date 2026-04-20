'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function CollectionsPage() {
  const t = useTranslations('pages');
  return (
    <LiveDataRequiredPage
      title={t('collectionsTitle')}
      feature={t('collectionsFeature')}
      description={t('collectionsDescription')}
    />
  );
}
