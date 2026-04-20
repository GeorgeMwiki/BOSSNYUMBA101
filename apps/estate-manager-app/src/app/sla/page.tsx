'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function SLADashboardPage() {
  const t = useTranslations('simple');
  return (
    <LiveDataRequiredPage
      title={t('slaDashboard')}
      feature="SLA telemetry"
      description="Fallback SLA metrics and health summaries have been removed. This dashboard now requires live SLA services."
    />
  );
}
