'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function MoveOutInspectionsPage() {
  const t = useTranslations('misc');
  return (
    <LiveDataRequiredPage
      title={t('moveOutInspections')}
      feature="move-out inspections"
      description="The previous page called /api/inspections/move-out, which does not exist. Wire to /api/v1/inspections on the gateway before re-enabling."
      showBack
    />
  );
}
