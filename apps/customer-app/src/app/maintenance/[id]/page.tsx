'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function MaintenanceDetailPage() {
  const t = useTranslations('pageHeaders');
  return (
    <LiveDataRequiredScreen
      title={t('maintenanceRequest')}
      feature="maintenance request detail"
      description="Placeholder maintenance details, photos, and synthetic progress states have been removed. This screen now requires live maintenance request data."
      showBack
    />
  );
}
