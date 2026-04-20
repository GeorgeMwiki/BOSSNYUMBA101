'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { workOrdersService } from '@bossnyumba/api-client';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

export default function WorkOrderDetailPage() {
  const t = useTranslations('workOrderSummary');
  const params = useParams();
  const id = (params?.id ?? '') as string;
  const workOrderQuery = useQuery({
    queryKey: ['work-order-detail-live', id],
    queryFn: () => workOrdersService.get(id),
    enabled: !!id,
    retry: false,
  });

  const workOrder = workOrderQuery.data?.data as any;

  return (
    <>
      <PageHeader title={workOrder?.workOrderNumber || t('titleFallback')} showBack />
      <div className="space-y-4 px-4 py-4 max-w-3xl mx-auto">
        {workOrderQuery.isLoading && <div className="card p-4 text-sm text-gray-500">{t('loading')}</div>}
        {workOrderQuery.error && <div className="card p-4 text-sm text-danger-600">{(workOrderQuery.error as Error).message}</div>}
        {workOrder && (
          <div className="card p-4 grid grid-cols-2 gap-4">
            <div className="col-span-2"><div className="text-sm text-gray-500">{t('title')}</div><div className="font-medium">{workOrder.title}</div></div>
            <div><div className="text-sm text-gray-500">{t('status')}</div><div className="font-medium">{workOrder.status}</div></div>
            <div><div className="text-sm text-gray-500">{t('priority')}</div><div className="font-medium">{workOrder.priority}</div></div>
            <div><div className="text-sm text-gray-500">{t('category')}</div><div className="font-medium">{workOrder.category}</div></div>
            <div><div className="text-sm text-gray-500">{t('location')}</div><div className="font-medium">{workOrder.location || t('na')}</div></div>
            <div className="col-span-2"><div className="text-sm text-gray-500">{t('description')}</div><div className="font-medium">{workOrder.description || t('noDescription')}</div></div>
          </div>
        )}
      </div>
    </>
  );
}
