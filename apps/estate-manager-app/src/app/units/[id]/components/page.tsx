'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function UnitComponentsPage() {
  const t = useTranslations('unitComponents');
  const params = useParams();
  const unitId = (params?.id as string) ?? '';
  return (
    <LiveDataRequiredPage
      title={t('title', { unitId })}
      feature="unit components (FAR grid)"
      description="The previous page called /api/units/{id}/components, which does not exist. Wire to a live unit-components endpoint on the gateway before re-enabling."
      showBack
    />
  );
}
