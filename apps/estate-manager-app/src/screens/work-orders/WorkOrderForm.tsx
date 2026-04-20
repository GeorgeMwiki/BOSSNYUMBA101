'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function WorkOrderForm() {
  const t = useTranslations('simple');
  return (
    <LiveDataRequiredPage
      title={t('createWorkOrder')}
      feature="work-order authoring data"
      description="Mock properties and units have been removed. Work-order creation now requires live property, unit, and workflow data."
      showBack
    />
  );
}
