'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function MaintenanceFeedbackPage() {
  const t = useTranslations('pageHeaders');
  return (
    <LiveDataRequiredScreen
      title={t('rateService')}
      feature="maintenance feedback submission"
      description="The previous screen posted to /api/maintenance/{id}/feedback, which does not exist. Wire to the live /api/v1/feedback endpoint before re-enabling."
      showBack
    />
  );
}
