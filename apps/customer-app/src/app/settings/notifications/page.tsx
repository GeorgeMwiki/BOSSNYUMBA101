'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function NotificationSettingsPage() {
  const t = useTranslations('pageHeaders');
  return (
    <LiveDataRequiredScreen
      title={t('notifications')}
      feature="notification preferences"
      description="This screen requires the live notification-preferences endpoint. The local /api/customer/* fetch path it previously called does not exist."
      showBack
    />
  );
}
