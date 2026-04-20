'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function WorkOrdersPage() {
  const t = useTranslations('simple');
  return (
    <LiveDataRequiredPage
      title={t('workOrders')}
      feature="work-order operations"
      description="Mock work orders, assignments, and approvals have been removed. This screen now requires live work-order, vendor, and approval data."
    />
  );
}
