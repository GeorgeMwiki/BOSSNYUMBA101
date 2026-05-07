'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function FeedbackPage() {
  const t = useTranslations('pageHeaders');
  return (
    <LiveDataRequiredScreen
      title={t('rateService')}
      feature="request feedback"
      description="Hardcoded request context and simulated submit have been removed. This screen now requires live work-order feedback wiring."
      showBack
    />
  );
}
