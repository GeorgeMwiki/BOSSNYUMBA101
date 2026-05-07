'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function UtilitiesPage() {
  const t = useTranslations('pageHeaders');
  return (
    <LiveDataRequiredScreen
      title={t('utilities')}
      feature="utility readings and bills"
      description="Hardcoded utility readings and bill totals have been removed. This screen now requires live utility data from the gateway."
    />
  );
}
