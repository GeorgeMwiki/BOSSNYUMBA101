'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { workOrdersService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

export default function WorkOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const workOrderQuery = useQuery({
    queryKey: ['work-order-detail-live', id],
    queryFn: () => workOrdersService.get(id),
    enabled: !!id,
    retry: false,
  });

  const workOrder = workOrderQuery.data?.data;

  return (
    <>
      <PageHeader title={workOrder?.workOrderNumber || 'Work Order'} showBack />
      <div className="space-y-4 px-4 py-4 max-w-3xl mx-auto">
        {workOrderQuery.isLoading && <div className="card p-4 text-sm text-gray-500">Loading work order...</div>}
        {workOrderQuery.error && <div className="card p-4 text-sm text-danger-600">{(workOrderQuery.error as Error).message}</div>}
        {workOrder && (
          <div className="card p-4 grid grid-cols-2 gap-4">
            <div className="col-span-2"><div className="text-sm text-gray-500">Title</div><div className="font-medium">{workOrder.title}</div></div>
            <div><div className="text-sm text-gray-500">Status</div><div className="font-medium">{workOrder.status}</div></div>
            <div><div className="text-sm text-gray-500">Priority</div><div className="font-medium">{workOrder.priority}</div></div>
            <div><div className="text-sm text-gray-500">Category</div><div className="font-medium">{workOrder.category}</div></div>
            <div><div className="text-sm text-gray-500">Location</div><div className="font-medium">{workOrder.location || 'N/A'}</div></div>
            <div className="col-span-2"><div className="text-sm text-gray-500">Description</div><div className="font-medium">{workOrder.description || 'No description'}</div></div>
          </div>
        )}
      </div>
    </>
  );
}
