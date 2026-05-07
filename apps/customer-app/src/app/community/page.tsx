'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function CommunityPage() {
  const t = useTranslations('pageHeaders');
  return (
    <LiveDataRequiredScreen
      title={t('community')}
      feature="community feed"
      description="Static placeholder community posts have been removed. This screen now requires a live community-feed backend."
      showBack
    />
  );
}
