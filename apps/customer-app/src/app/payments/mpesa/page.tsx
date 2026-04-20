'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function MpesaPage() {
  const t = useTranslations('pageHeaders');
  return (
    <LiveDataRequiredScreen
      title={t('mpesa')}
      feature="M-Pesa payment initiation"
      description="Simulated M-Pesa payment outcomes have been removed. This screen now requires a live payment initiation and callback flow."
      showBack
    />
  );
}
