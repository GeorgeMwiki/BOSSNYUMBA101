'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsService, propertiesService, customersService } from '@bossnyumba/api-client';
import {
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

export default function AnalyticsPage() {
  const {
    data: financialReport,
    isLoading: loadingFinancial,
    error: financialError,
  } = useQuery({
    queryKey: ['admin-analytics-financial'],
    queryFn: async () => {
      const res = await reportsService.getFinancial();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load financial report');
    },
    staleTime: 30_000,
  });

  const {
    data: occupancy,
    isLoading: loadingOccupancy,
    error: occupancyError,
  } = useQuery({
    queryKey: ['admin-analytics-occupancy'],
    queryFn: async () => {
      const res = await reportsService.getOccupancy();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load occupancy report');
    },
    staleTime: 30_000,
  });

  const {
    data: customers,
    isLoading: loadingCustomers,
    error: customersError,
  } = useQuery({
    queryKey: ['admin-analytics-customers'],
    queryFn: async () => {
      const res = await customersService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load customers');
    },
    staleTime: 30_000,
  });

  const isLoading = loadingFinancial || loadingOccupancy || loadingCustomers;
  const error = financialError || occupancyError || customersError;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="space-y-2">
          <div className="h-7 bg-gray-200 rounded w-44" />
          <div className="h-4 bg-gray-200 rounded w-60" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="h-9 w-9 bg-gray-200 rounded-lg" />
              <div className="h-7 bg-gray-200 rounded w-28 mt-4" />
              <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="h-5 bg-gray-200 rounded w-44" />
          </div>
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-center gap-6 px-6 py-4 border-b border-gray-100">
              <div className="h-4 bg-gray-200 rounded w-20" />
              <div className="h-4 bg-gray-200 rounded w-28" />
              <div className="h-4 bg-gray-200 rounded w-28" />
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
        <h2 className="text-lg font-semibold text-gray-900">Analytics Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load analytics data. Please check your connection and try again.'}
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

  const customerList = Array.isArray(customers) ? customers : [];
  const totalRevenue = financialReport?.summary?.totalCollected || 0;
  const totalInvoiced = financialReport?.summary?.totalInvoiced || 0;
  const collectionRate = financialReport?.summary?.collectionRate || 0;
  const occupancyRate = occupancy?.summary?.occupancyRate || 0;
  const totalUnits = occupancy?.summary?.totalUnits || 0;
  const occupiedUnits = occupancy?.summary?.occupiedUnits || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Platform analytics and product telemetry</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <BarChart3 className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">TZS {totalRevenue.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Total Revenue</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-green-100 rounded-lg w-fit">
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{collectionRate.toFixed(1)}%</p>
            <p className="text-sm text-gray-500">Collection Rate</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{customerList.length}</p>
            <p className="text-sm text-gray-500">Total Customers</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-amber-100 rounded-lg w-fit">
            <Activity className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{occupancyRate.toFixed(1)}%</p>
            <p className="text-sm text-gray-500">Occupancy Rate ({occupiedUnits}/{totalUnits})</p>
          </div>
        </div>
      </div>

      {/* Monthly Revenue Trend */}
      {financialReport?.monthlyTrend && financialReport.monthlyTrend.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Monthly Revenue Trend</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoiced</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {financialReport.monthlyTrend.map((m: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{m.month}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">TZS {(m.invoiced || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">TZS {(m.collected || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Occupancy by Property */}
      {occupancy?.byProperty && occupancy.byProperty.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Occupancy by Property</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Occupied</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {occupancy.byProperty.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.totalUnits}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.occupiedUnits}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      p.occupancyRate >= 90 ? 'bg-green-100 text-green-700' :
                      p.occupancyRate >= 70 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {p.occupancyRate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
