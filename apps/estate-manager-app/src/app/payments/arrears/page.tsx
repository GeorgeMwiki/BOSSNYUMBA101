'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function ArrearsPage() {
  const t = useTranslations('arrearsGrid');
  return (
    <LiveDataRequiredPage
      title={t('title')}
      feature="arrears grid"
      description="The previous page called /api/payments/arrears and /api/payments/arrears/reminders, which do not exist. Wire to /api/v1/arrears on the gateway before re-enabling."
    />
  );
}
