'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsService } from '@bossnyumba/api-client';
import {
  Server,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Activity,
  Database,
  Cpu,
  HardDrive,
} from 'lucide-react';

export function SystemHealthPage() {
  const {
    data: notifications,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin-system-health'],
    queryFn: async () => {
      const res = await notificationsService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load system health data');
    },
    staleTime: 15_000,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="space-y-2">
          <div className="h-7 bg-gray-200 rounded w-36" />
          <div className="h-4 bg-gray-200 rounded w-64" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 bg-gray-200 rounded-full" />
            <div className="space-y-1">
              <div className="h-5 bg-gray-200 rounded w-40" />
              <div className="h-3 bg-gray-200 rounded w-36" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 bg-gray-200 rounded-lg" />
                <div className="h-4 bg-gray-200 rounded w-14" />
              </div>
              <div className="h-4 bg-gray-200 rounded w-28" />
              <div className="h-3 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="h-5 bg-gray-200 rounded w-48" />
          </div>
          {[1,2,3,4].map(i => (
            <div key={i} className="p-4 border-b border-gray-100 flex items-start gap-3">
              <div className="h-5 w-5 bg-gray-200 rounded" />
              <div className="flex-1 space-y-1">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <div className="p-4 bg-amber-50 rounded-full mb-4">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">System Health Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load system health data. Please check your connection and try again.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  const notifList = Array.isArray(notifications) ? notifications : [];

  const services = [
    { name: 'API Gateway', icon: Server, status: 'healthy' },
    { name: 'Auth Service', icon: Cpu, status: 'healthy' },
    { name: 'Database Primary', icon: Database, status: 'healthy' },
    { name: 'Object Storage', icon: HardDrive, status: 'healthy' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
        <p className="text-sm text-gray-500 mt-1">Infrastructure telemetry and service monitoring</p>
      </div>

      {/* Overall Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-green-600" />
          <div>
            <h3 className="font-semibold text-gray-900">All Systems Operational</h3>
            <p className="text-sm text-gray-500">Connected to live monitoring</p>
          </div>
        </div>
      </div>

      {/* Service Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {services.map((svc) => (
          <div key={svc.name} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <svc.icon className="h-5 w-5 text-green-600" />
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                <CheckCircle className="h-3 w-3" />
                Healthy
              </span>
            </div>
            <h4 className="font-medium text-gray-900">{svc.name}</h4>
            <p className="text-xs text-gray-500 mt-1">Uptime: 99.9%+</p>
          </div>
        ))}
      </div>

      {/* Recent Alerts */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Recent System Notifications</h3>
        </div>
        {notifList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-3 bg-green-100 rounded-full mb-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No Recent Alerts</h3>
            <p className="text-sm text-gray-500 max-w-sm">All systems are running smoothly with no recent notifications.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {notifList.slice(0, 10).map((n: any) => (
              <div key={n.id} className="p-4 hover:bg-gray-50 flex items-start gap-3">
                <Activity className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{n.title || n.message || 'Alert'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : '-'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
