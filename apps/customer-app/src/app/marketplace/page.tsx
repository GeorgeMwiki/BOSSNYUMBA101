'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function MarketplacePage() {
  const t = useTranslations('pageHeaders');
  return (
    <LiveDataRequiredScreen
      title={t('marketplace')}
      feature="marketplace listings"
      description="Static marketplace vendor listings have been removed. This page now requires live vendor and catalog data."
    />
  );
}
