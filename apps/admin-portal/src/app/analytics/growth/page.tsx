'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsService, propertiesService, invoicesService } from '@bossnyumba/api-client';
import {
  TrendingUp,
  DollarSign,
  Building2,
  RefreshCw,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';

export default function AnalyticsGrowthPage() {
  const {
    data: financialReport,
    isLoading: loadingFinancial,
    error: financialError,
  } = useQuery({
    queryKey: ['admin-growth-financial'],
    queryFn: async () => {
      const res = await reportsService.getFinancial();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load financial data');
    },
    staleTime: 30_000,
  });

  const {
    data: properties,
    isLoading: loadingProps,
    error: propsError,
  } = useQuery({
    queryKey: ['admin-growth-properties'],
    queryFn: async () => {
      const res = await propertiesService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load properties');
    },
    staleTime: 30_000,
  });

  const {
    data: invoices,
    isLoading: loadingInvoices,
    error: invoicesError,
  } = useQuery({
    queryKey: ['admin-growth-invoices'],
    queryFn: async () => {
      const res = await invoicesService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load invoice data');
    },
    staleTime: 30_000,
  });

  const isLoading = loadingFinancial || loadingProps || loadingInvoices;
  const error = financialError || propsError || invoicesError;

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
        <h2 className="text-lg font-semibold text-gray-900">Growth Analytics Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load growth data.'}
        </p>
      </div>
    );
  }

  const propertyList = Array.isArray(properties) ? properties : [];
  const invoiceList = Array.isArray(invoices) ? invoices : [];
  const totalRevenue = financialReport?.summary?.totalCollected || 0;
  const totalInvoiced = financialReport?.summary?.totalInvoiced || 0;
  const collectionRate = financialReport?.summary?.collectionRate || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Growth Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Revenue growth, property expansion, and financial telemetry</p>
      </div>

      {/* Growth Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <Building2 className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{propertyList.length}</p>
            <p className="text-sm text-gray-500">Total Properties</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-green-100 rounded-lg w-fit">
            <DollarSign className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">KES {totalRevenue.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Total Revenue</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <TrendingUp className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{collectionRate.toFixed(1)}%</p>
            <p className="text-sm text-gray-500">Collection Rate</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-amber-100 rounded-lg w-fit">
            <BarChart3 className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{invoiceList.length}</p>
            <p className="text-sm text-gray-500">Total Invoices</p>
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
                  <td className="px-6 py-4 text-sm text-gray-600">KES {(m.invoiced || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">KES {(m.collected || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Properties Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Property Portfolio</h3>
        </div>
        {propertyList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No properties found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Occupancy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {propertyList.slice(0, 15).map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.type || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {p.status || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.totalUnits || 0}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {p.totalUnits > 0 ? `${((p.occupiedUnits / p.totalUnits) * 100).toFixed(0)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
