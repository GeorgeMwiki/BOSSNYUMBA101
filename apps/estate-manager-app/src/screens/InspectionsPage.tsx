'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function InspectionsPage() {
  const t = useTranslations('pages');
  return (
    <LiveDataRequiredPage
      title={t('inspectionsTitle')}
      feature={t('inspectionsFeature')}
      description={t('inspectionsDescription')}
    />
  );
}
