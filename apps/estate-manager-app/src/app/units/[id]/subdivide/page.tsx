'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function UnitSubdividePage() {
  const t = useTranslations('misc');
  const params = useParams();
  const unitId = (params?.id as string) ?? '';
  return (
    <LiveDataRequiredPage
      title={t('subdivideTitle', { unitId })}
      feature="unit subdivision"
      description="The previous page called /api/units/{id}/subdivision, which does not exist. Wire to a live unit-subdivision endpoint on the gateway before re-enabling."
      showBack
    />
  );
}
