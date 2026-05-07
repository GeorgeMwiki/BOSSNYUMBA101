'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function ConductInspectionPage() {
  const t = useTranslations('conductInspection');
  return (
    <LiveDataRequiredPage
      title={t('title')}
      feature="conduct inspection"
      description="The previous workflow used hardcoded inspection areas and posted to /api/inspections/{id}/complete (the gateway equivalent currently returns notImplemented). Wire to the live inspection submission endpoint before re-enabling."
      showBack
    />
  );
}
