'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function ConductInspectionPage() {
  const t = useTranslations('conductInspection');
  // ENGINEERING NOTE (not user-facing): the previous workflow used hardcoded
  // inspection areas and posted to /api/inspections/{id}/complete, whose
  // gateway equivalent currently returns notImplemented. Wire to the live
  // inspection submission endpoint before re-enabling this surface.
  return (
    <LiveDataRequiredPage
      title={t('title')}
      feature={t('title')}
      description={t('unavailableDescription')}
      showBack
    />
  );
}
