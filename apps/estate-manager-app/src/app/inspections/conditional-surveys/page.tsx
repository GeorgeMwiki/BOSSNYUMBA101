'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function ConditionalSurveysPage() {
  const t = useTranslations('conditionalSurveys');
  return (
    <LiveDataRequiredPage
      title={t('title')}
      feature="conditional surveys"
      description="The previous page called /api/inspections/conditional-surveys, which does not exist. Wire to /api/v1/conditional-surveys on the gateway before re-enabling."
      showBack
    />
  );
}
