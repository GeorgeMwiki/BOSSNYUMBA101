'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPanel } from '@/components/LiveDataRequired';

export function StoriesBar() {
  const t = useTranslations('screenUnavailable');
  return (
    <LiveDataRequiredPanel
      title={t('storiesTitle')}
      message={t('storiesMessage')}
    />
  );
}
