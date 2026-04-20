'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { workOrdersService } from '@bossnyumba/api-client';
import { Alert, AlertDescription, Button, EmptyState } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';

export default function WorkOrdersList() {
  const t = useTranslations('lists');
  const workOrdersQuery = useQuery({
    queryKey: ['work-orders-list-live'],
    queryFn: () => workOrdersService.list(undefined, 1, 50),
    retry: false,
  });

  const workOrders = workOrdersQuery.data?.data ?? [];

  return (
    <>
      <PageHeader
        title={t('workOrdersTitle')}
        subtitle={t('workOrdersItems', { count: workOrders.length })}
        action={<Link href="/work-orders/new" className="btn-primary text-sm flex items-center gap-1"><Plus className="w-4 h-4" />{t('workOrdersAdd')}</Link>}
      />
      <div className="space-y-3 px-4 py-4 max-w-4xl mx-auto">
        {workOrdersQuery.isLoading && <div className="card p-4 text-sm text-gray-500">{t('workOrdersLoading')}</div>}
        {workOrdersQuery.error && (
          <Alert variant="danger">
            <AlertDescription>
              {(workOrdersQuery.error as Error).message || t('workOrdersFailed')}
              <Button size="sm" onClick={() => workOrdersQuery.refetch()} className="ml-2">
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {!workOrdersQuery.isLoading && !workOrdersQuery.error && workOrders.length === 0 && (
          <EmptyState
            icon={<Wrench className="h-8 w-8" />}
            title={t('workOrdersEmptyTitle')}
            description={t('workOrdersEmptyDesc')}
            action={
              <Link href="/work-orders/new" className="btn-primary inline-block">
                {t('workOrdersEmptyCta')}
              </Link>
            }
          />
        )}
        {workOrders.map((workOrder: any) => (
          <Link key={workOrder.id} href={`/work-orders/${workOrder.id}`} className="card block p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{workOrder.title}</div>
                <div className="text-sm text-gray-500">{workOrder.workOrderNumber || workOrder.ticketNumber}</div>
              </div>
              <div className="text-right">
                <div className="badge-info text-xs">{workOrder.status}</div>
                <div className="mt-1 text-sm text-gray-500">{workOrder.priority}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
