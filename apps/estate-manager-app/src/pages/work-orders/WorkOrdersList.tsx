'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { workOrdersService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

export default function WorkOrdersList() {
  const workOrdersQuery = useQuery({
    queryKey: ['work-orders-list-live'],
    queryFn: () => workOrdersService.list(undefined, 1, 50),
    retry: false,
  });

  const workOrders = workOrdersQuery.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Work Orders"
        subtitle={`${workOrders.length} items`}
        action={<Link href="/work-orders/new" className="btn-primary text-sm flex items-center gap-1"><Plus className="w-4 h-4" />Add</Link>}
      />
      <div className="space-y-3 px-4 py-4 max-w-4xl mx-auto">
        {workOrdersQuery.isLoading && <div className="card p-4 text-sm text-gray-500">Loading work orders...</div>}
        {workOrdersQuery.error && <div className="card p-4 text-sm text-danger-600">{(workOrdersQuery.error as Error).message}</div>}
        {!workOrdersQuery.isLoading && !workOrdersQuery.error && workOrders.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-gray-500 font-medium">No work orders found</p>
            <p className="text-sm text-gray-400 mt-1">Work orders will appear here once created.</p>
          </div>
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
