'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { customersService, paymentsService, leasesService } from '@bossnyumba/api-client';
import {
  Users,
  Clock,
  DollarSign,
  FileText,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

export default function CustomerTimeline() {
  const {
    data: customers,
    isLoading: loadingCustomers,
    error: customersError,
  } = useQuery({
    queryKey: ['admin-customer-timeline'],
    queryFn: async () => {
      const res = await customersService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load customer data');
    },
    staleTime: 30_000,
  });

  const {
    data: payments,
    isLoading: loadingPayments,
    error: paymentsError,
  } = useQuery({
    queryKey: ['admin-customer-timeline-payments'],
    queryFn: async () => {
      const res = await paymentsService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load payments');
    },
    staleTime: 30_000,
  });

  const isLoading = loadingCustomers || loadingPayments;
  const error = customersError || paymentsError;

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
        <h2 className="text-lg font-semibold text-gray-900">Customer Timeline Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load customer timeline.'}
        </p>
      </div>
    );
  }

  const customerList = Array.isArray(customers) ? customers : [];
  const paymentList = Array.isArray(payments) ? payments : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customer Timeline</h1>
        <p className="text-sm text-gray-500 mt-1">Cross-tenant customer activity and history</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="p-2 bg-green-100 rounded-lg w-fit">
            <DollarSign className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{paymentList.length}</p>
            <p className="text-sm text-gray-500">Total Payments</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <Clock className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">--</p>
            <p className="text-sm text-gray-500">Active Events</p>
          </div>
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Customers</h3>
        </div>
        {customerList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No customers found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {customerList.slice(0, 15).map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.email || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {c.status || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-'}
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
