'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function DamageDisputesPage() {
  const t = useTranslations('disputesPage');
  return (
    <LiveDataRequiredScreen
      title={t('title')}
      feature="damage-deduction disputes"
      description="The previous screen called /api/customer/lease/move-out/disputes, which does not exist. Wire to the live /api/v1/damage-deductions endpoint before re-enabling."
      showBack
    />
  );
}
