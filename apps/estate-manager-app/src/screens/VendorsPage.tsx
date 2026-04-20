'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function VendorsPage() {
  const t = useTranslations('pages');
  return (
    <LiveDataRequiredPage
      title={t('vendorsTitle')}
      feature={t('vendorsFeature')}
      description={t('vendorsDescription')}
    />
  );
}
