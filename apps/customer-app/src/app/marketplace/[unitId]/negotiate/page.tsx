'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function NegotiatePage() {
  const t = useTranslations('pageHeaders');
  return (
    <LiveDataRequiredScreen
      title={t('marketplace')}
      feature="rent negotiation"
      description="The previous screen called /api/marketplace/* paths that do not exist. Wire to the live /api/v1/negotiations and /api/v1/marketplace endpoints before re-enabling."
      showBack
    />
  );
}
