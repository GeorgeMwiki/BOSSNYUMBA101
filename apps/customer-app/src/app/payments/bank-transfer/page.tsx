'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function BankTransferPage() {
  const t = useTranslations('pageHeaders');
  return (
    <LiveDataRequiredScreen
      title={t('bankTransfer')}
      feature="Bank transfer payment instructions"
      description="The static bank account list and generated payment references have been removed. This flow requires a live payment configuration service and issued transfer instructions."
      showBack
    />
  );
}
