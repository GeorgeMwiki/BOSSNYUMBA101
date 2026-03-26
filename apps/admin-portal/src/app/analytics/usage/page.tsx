'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsService, propertiesService, customersService } from '@bossnyumba/api-client';
import {
  BarChart3,
  Users,
  Activity,
  Clock,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

export default function AnalyticsUsagePage() {
  const {
    data: occupancy,
    isLoading: loadingOccupancy,
    error: occupancyError,
  } = useQuery({
    queryKey: ['admin-usage-occupancy'],
    queryFn: async () => {
      const res = await reportsService.getOccupancy();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load occupancy data');
    },
    staleTime: 30_000,
  });

  const {
    data: customers,
    isLoading: loadingCustomers,
    error: customersError,
  } = useQuery({
    queryKey: ['admin-usage-customers'],
    queryFn: async () => {
      const res = await customersService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load customer data');
    },
    staleTime: 30_000,
  });

  const {
    data: properties,
    isLoading: loadingProps,
    error: propsError,
  } = useQuery({
    queryKey: ['admin-usage-properties'],
    queryFn: async () => {
      const res = await propertiesService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load properties');
    },
    staleTime: 30_000,
  });

  const isLoading = loadingOccupancy || loadingCustomers || loadingProps;
  const error = occupancyError || customersError || propsError;

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
        <h2 className="text-lg font-semibold text-gray-900">Usage Analytics Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load usage data.'}
        </p>
      </div>
    );
  }

  const customerList = Array.isArray(customers) ? customers : [];
  const propertyList = Array.isArray(properties) ? properties : [];
  const totalUnits = occupancy?.summary?.totalUnits || 0;
  const occupiedUnits = occupancy?.summary?.occupiedUnits || 0;
  const occupancyRate = occupancy?.summary?.occupancyRate || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usage Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Product usage telemetry and engagement metrics</p>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <Users className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{customerList.length}</p>
            <p className="text-sm text-gray-500">Total Customers</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{occupancyRate.toFixed(1)}%</p>
            <p className="text-sm text-gray-500">Occupancy Rate</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-green-100 rounded-lg w-fit">
            <Activity className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{occupiedUnits}/{totalUnits}</p>
            <p className="text-sm text-gray-500">Occupied Units</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-amber-100 rounded-lg w-fit">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{propertyList.length}</p>
            <p className="text-sm text-gray-500">Properties</p>
          </div>
        </div>
      </div>

      {/* Property Usage Table */}
      {occupancy?.byProperty && occupancy.byProperty.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Usage by Property</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Units</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Occupied</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Occupancy Rate</th>
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
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Properties</h3>
          </div>
          {propertyList.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No usage data available</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Occupied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {propertyList.slice(0, 15).map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.name}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {p.status || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.totalUnits || 0}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.occupiedUnits || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
