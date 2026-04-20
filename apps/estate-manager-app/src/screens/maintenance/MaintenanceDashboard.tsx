'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function MaintenanceDashboard() {
  const t = useTranslations('simple');
  return (
    <LiveDataRequiredPage
      title={t('maintenanceDashboard')}
      feature="maintenance dashboard telemetry"
      description="Fallback SLA summaries, category counts, and vendor scorecards have been removed. This dashboard now requires live maintenance analytics."
    />
  );
}
