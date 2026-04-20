'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function PaymentPlanPage() {
  const t = useTranslations('pageHeaders');
  return (
    <LiveDataRequiredScreen
      title={t('paymentPlan')}
      feature="payment plan data"
      description="Local-storage payment plan fallbacks and generated timelines have been removed. This screen now requires live payment plan and balance data."
      showBack
    />
  );
}
