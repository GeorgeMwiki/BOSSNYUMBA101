'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function RequestDetailPage() {
  const t = useTranslations('pageHeaders');
  return (
    <LiveDataRequiredScreen
      title={t('requestDetail')}
      feature="request detail data"
      description="Mock request conversations, placeholder images, and local request state have been removed. This screen now requires live request and messaging data."
      showBack
    />
  );
}
