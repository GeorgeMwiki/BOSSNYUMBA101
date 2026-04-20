'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function OccupancyPage() {
  const t = useTranslations('pages');
  return (
    <LiveDataRequiredPage
      title={t('occupancyTitle')}
      feature={t('occupancyFeature')}
      description={t('occupancyDescription')}
    />
  );
}
