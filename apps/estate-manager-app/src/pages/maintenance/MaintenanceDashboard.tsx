'use client';

import { useQuery } from '@tanstack/react-query';
import { workOrdersService } from '@bossnyumba/api-client';

export default function MaintenanceDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['workOrders', 'all'],
    queryFn: () => workOrdersService.list({}),
  });

  const workOrders = data?.data ?? [];

  const openOrders = workOrders.filter((wo: any) => wo.status === 'open' || wo.status === 'pending');
  const inProgressOrders = workOrders.filter((wo: any) => wo.status === 'in_progress');
  const completedOrders = workOrders.filter((wo: any) => wo.status === 'completed');
  const urgentOrders = workOrders.filter((wo: any) => wo.priority === 'urgent' || wo.priority === 'high');

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  workOrders.forEach((wo: any) => {
    const cat = wo.category || 'general';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Failed to load maintenance data: {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Maintenance Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-yellow-600">{openOrders.length}</p>
          <p className="text-sm text-gray-500 mt-1">Open</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{inProgressOrders.length}</p>
          <p className="text-sm text-gray-500 mt-1">In Progress</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{completedOrders.length}</p>
          <p className="text-sm text-gray-500 mt-1">Completed</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{urgentOrders.length}</p>
          <p className="text-sm text-gray-500 mt-1">Urgent/High</p>
        </div>
      </div>

      {/* Category Breakdown */}
      {Object.keys(categoryCounts).length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold mb-3">By Category</h2>
          <div className="space-y-2">
            {Object.entries(categoryCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => (
                <div key={category} className="flex justify-between items-center">
                  <span className="text-sm capitalize">{category.replace('_', ' ')}</span>
                  <span className="text-sm font-medium bg-gray-100 px-2 py-1 rounded">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent Work Orders */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Work Orders</h2>
          <a href="/work-orders" className="text-sm text-primary-600">View All</a>
        </div>

        {workOrders.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg font-medium">No work orders</p>
            <p className="text-sm mt-1">Work orders will appear here once created.</p>
          </div>
        )}

        {workOrders.slice(0, 5).map((wo: any) => (
          <a
            key={wo.id}
            href={`/work-orders/${wo.id}`}
            className="card p-4 block hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{wo.title || 'Work Order'}</h3>
                <p className="text-sm text-gray-500 mt-1 capitalize">
                  {wo.category?.replace('_', ' ') || 'General'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {wo.createdAt ? new Date(wo.createdAt).toLocaleDateString() : ''}
                </p>
              </div>
              <div className="text-right space-y-1">
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    wo.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : wo.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {wo.status?.replace('_', ' ') || 'open'}
                </span>
                {(wo.priority === 'urgent' || wo.priority === 'high') && (
                  <div>
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700">
                      {wo.priority}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
