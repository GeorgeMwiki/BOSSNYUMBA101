'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsService, slaService } from '@bossnyumba/api-client';
import {
  Brain,
  Activity,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Shield,
  Eye,
} from 'lucide-react';

export default function AICockpit() {
  const {
    data: maintenanceReport,
    isLoading: loadingMaintenance,
    error: maintenanceError,
    refetch: refetchMaintenance,
  } = useQuery({
    queryKey: ['admin-ai-cockpit-maintenance'],
    queryFn: async () => {
      const res = await reportsService.getMaintenance();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load maintenance report');
    },
    staleTime: 30_000,
  });

  const {
    data: slaMetrics,
    isLoading: loadingSLA,
    error: slaError,
    refetch: refetchSLA,
  } = useQuery({
    queryKey: ['admin-ai-cockpit-sla'],
    queryFn: async () => {
      const res = await slaService.getMetrics('month');
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load SLA metrics');
    },
    staleTime: 30_000,
  });

  const isLoading = loadingMaintenance || loadingSLA;
  const error = maintenanceError || slaError;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="space-y-2">
          <div className="h-7 bg-gray-200 rounded w-28" />
          <div className="h-4 bg-gray-200 rounded w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="h-9 w-9 bg-gray-200 rounded-lg" />
              <div className="h-7 bg-gray-200 rounded w-16 mt-4" />
              <div className="h-3 bg-gray-200 rounded w-32" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="h-5 bg-gray-200 rounded w-32" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="space-y-1">
                <div className="h-3 bg-gray-200 rounded w-28" />
                <div className="h-5 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="h-5 bg-gray-200 rounded w-44" />
          </div>
          {[1,2,3].map(i => (
            <div key={i} className="flex items-center gap-6 px-6 py-4 border-b border-gray-100">
              <div className="h-4 bg-gray-200 rounded w-28" />
              <div className="h-4 bg-gray-200 rounded w-12" />
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
        <h2 className="text-lg font-semibold text-gray-900">AI Cockpit Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load AI governance data. Please check your connection and try again.'}
        </p>
        <button
          onClick={() => { refetchMaintenance(); refetchSLA(); }}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  const summary = maintenanceReport?.summary;
  const sla = slaMetrics?.overall;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Cockpit</h1>
        <p className="text-sm text-gray-500 mt-1">AI governance, telemetry, and decision audit</p>
      </div>

      {/* AI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <Brain className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{summary?.total || 0}</p>
            <p className="text-sm text-gray-500">Total Work Orders Analyzed</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-green-100 rounded-lg w-fit">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{summary?.completed || 0}</p>
            <p className="text-sm text-gray-500">Completed</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-amber-100 rounded-lg w-fit">
            <Eye className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{summary?.open || 0}</p>
            <p className="text-sm text-gray-500">Open / Pending Review</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <Shield className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{(summary?.completionRate || 0).toFixed(1)}%</p>
            <p className="text-sm text-gray-500">Completion Rate</p>
          </div>
        </div>
      </div>

      {/* SLA Performance */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">SLA Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase">Response Compliance</p>
            <p className="text-lg font-bold text-gray-900 mt-1">
              {(sla?.responseComplianceRate || 0).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Resolution Compliance</p>
            <p className="text-lg font-bold text-gray-900 mt-1">
              {(sla?.resolutionComplianceRate || 0).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Avg Response Time</p>
            <p className="text-lg font-bold text-gray-900 mt-1">
              {(sla?.averageResponseTimeMinutes || 0).toFixed(0)}m
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Avg Resolution Time</p>
            <p className="text-lg font-bold text-gray-900 mt-1">
              {(sla?.averageResolutionTimeMinutes || 0).toFixed(0)}m
            </p>
          </div>
        </div>
      </div>

      {/* Maintenance by Category */}
      {maintenanceReport?.byCategory && maintenanceReport.byCategory.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Work Orders by Category</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {maintenanceReport.byCategory.map((cat: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{cat.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{cat.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Maintenance by Priority */}
      {maintenanceReport?.byPriority && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Work Orders by Priority</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-red-50">
              <p className="text-2xl font-bold text-red-600">{maintenanceReport.byPriority.emergency || 0}</p>
              <p className="text-xs text-red-600 mt-1">Emergency</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-50">
              <p className="text-2xl font-bold text-amber-600">{maintenanceReport.byPriority.high || 0}</p>
              <p className="text-xs text-amber-600 mt-1">High</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-50">
              <p className="text-2xl font-bold text-blue-600">{maintenanceReport.byPriority.medium || 0}</p>
              <p className="text-xs text-blue-600 mt-1">Medium</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50">
              <p className="text-2xl font-bold text-gray-600">{maintenanceReport.byPriority.low || 0}</p>
              <p className="text-xs text-gray-600 mt-1">Low</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
