'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function HomePage() {
  const t = useTranslations('nav');
  return (
    <LiveDataRequiredScreen
      title={t('home')}
      feature="resident feed and marketplace data"
      description="Synthetic feed posts and vendor cards have been removed. The home screen now requires live resident feed, announcement, and marketplace data."
    />
  );
}
