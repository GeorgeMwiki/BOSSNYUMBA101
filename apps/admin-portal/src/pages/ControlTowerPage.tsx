'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { workOrdersService, notificationsService } from '@bossnyumba/api-client';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Server,
  Zap,
  Bell,
} from 'lucide-react';

export function ControlTowerPage() {
  const {
    data: workOrders,
    isLoading: loadingWO,
    error: woError,
  } = useQuery({
    queryKey: ['admin-control-tower-wo'],
    queryFn: async () => {
      const res = await workOrdersService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load work orders');
    },
    staleTime: 30_000,
  });

  const {
    data: notifications,
    isLoading: loadingNotif,
    error: notifError,
  } = useQuery({
    queryKey: ['admin-control-tower-notif'],
    queryFn: async () => {
      const res = await notificationsService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load notifications');
    },
    staleTime: 30_000,
  });

  const isLoading = loadingWO || loadingNotif;
  const error = woError || notifError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-violet-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Control Tower Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load operations data.'}
        </p>
      </div>
    );
  }

  const woList = Array.isArray(workOrders) ? workOrders : [];
  const notifList = Array.isArray(notifications) ? notifications : [];

  const openWO = woList.filter((w: any) => w.status === 'OPEN' || w.status === 'SUBMITTED').length;
  const inProgressWO = woList.filter((w: any) => w.status === 'IN_PROGRESS').length;
  const completedWO = woList.filter((w: any) => w.status === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Control Tower</h1>
        <p className="text-sm text-gray-500 mt-1">Live operations, review queues, and incident streams</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <Activity className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{woList.length}</p>
            <p className="text-sm text-gray-500">Total Work Orders</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-amber-100 rounded-lg w-fit">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{openWO}</p>
            <p className="text-sm text-gray-500">Open</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <Zap className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{inProgressWO}</p>
            <p className="text-sm text-gray-500">In Progress</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-green-100 rounded-lg w-fit">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{completedWO}</p>
            <p className="text-sm text-gray-500">Completed</p>
          </div>
        </div>
      </div>

      {/* Recent Notifications */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Recent Notifications</h3>
        </div>
        {notifList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No recent notifications</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {notifList.slice(0, 10).map((n: any) => (
              <div key={n.id} className="p-4 hover:bg-gray-50 flex items-start gap-3">
                <Bell className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{n.title || n.message || 'Notification'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : '-'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Work Orders */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Recent Work Orders</h3>
        </div>
        {woList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No work orders found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {woList.slice(0, 10).map((wo: any) => (
                <tr key={wo.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{wo.number || wo.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{wo.title || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      wo.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      wo.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {wo.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{wo.priority || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
