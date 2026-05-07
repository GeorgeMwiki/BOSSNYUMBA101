'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function MaintenancePage() {
  const t = useTranslations('pageHeaders');
  return (
    <LiveDataRequiredScreen
      title={t('maintenance')}
      feature="maintenance ticket list"
      description="Static placeholder work orders have been removed. This screen now requires live maintenance ticket data from the gateway."
    />
  );
}
