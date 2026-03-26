'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { workOrdersService } from '@bossnyumba/api-client';

export default function WorkOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['workOrders', statusFilter, priorityFilter],
    queryFn: () =>
      workOrdersService.list({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      }),
  });

  const workOrders = data?.data ?? [];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Work Orders</h1>
        <a href="/work-orders/new" className="btn-primary text-sm">
          New Work Order
        </a>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto">
        {['', 'open', 'in_progress', 'completed', 'cancelled'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`btn text-sm whitespace-nowrap ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
          >
            {status ? status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'All'}
          </button>
        ))}
      </div>

      {/* Priority Filter */}
      <div className="flex gap-2 overflow-x-auto">
        {['', 'urgent', 'high', 'medium', 'low'].map((priority) => (
          <button
            key={priority}
            onClick={() => setPriorityFilter(priority)}
            className={`btn text-xs whitespace-nowrap ${priorityFilter === priority ? 'btn-primary' : 'btn-secondary'}`}
          >
            {priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Any Priority'}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Failed to load work orders: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && workOrders.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No work orders found</p>
          <p className="text-sm mt-1">Work orders will appear here once created.</p>
        </div>
      )}

      <div className="space-y-3">
        {workOrders.map((wo: any) => (
          <a
            key={wo.id}
            href={`/work-orders/${wo.id}`}
            className="card p-4 block hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{wo.title || 'Work Order'}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {wo.propertyName || wo.property?.name || 'Property'}
                  {wo.unitName || wo.unit?.name ? ` - ${wo.unitName || wo.unit?.name}` : ''}
                </p>
                <p className="text-xs text-gray-400 mt-1 capitalize">
                  {wo.category?.replace('_', ' ') || 'General'}
                  {wo.createdAt ? ` | ${new Date(wo.createdAt).toLocaleDateString()}` : ''}
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
                {wo.priority && wo.priority !== 'medium' && (
                  <div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        wo.priority === 'urgent' || wo.priority === 'high'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
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
