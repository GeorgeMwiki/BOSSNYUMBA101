'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { customersService, workOrdersService } from '@bossnyumba/api-client';
import {
  Wrench,
  Users,
  Search,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { useState } from 'react';

export function SupportToolingPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: customers,
    isLoading: loadingCustomers,
    error: customersError,
  } = useQuery({
    queryKey: ['admin-support-tooling-customers'],
    queryFn: async () => {
      const res = await customersService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load customers');
    },
    staleTime: 30_000,
  });

  const {
    data: workOrders,
    isLoading: loadingWO,
    error: woError,
  } = useQuery({
    queryKey: ['admin-support-tooling-wo'],
    queryFn: async () => {
      const res = await workOrdersService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load work orders');
    },
    staleTime: 30_000,
  });

  const isLoading = loadingCustomers || loadingWO;
  const error = customersError || woError;

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
        <h2 className="text-lg font-semibold text-gray-900">Support Tooling Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load support data.'}
        </p>
      </div>
    );
  }

  const customerList = Array.isArray(customers) ? customers : [];
  const woList = Array.isArray(workOrders) ? workOrders : [];

  const filteredCustomers = customerList.filter((c: any) =>
    (c.name || `${c.firstName || ''} ${c.lastName || ''}`).toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support Tooling</h1>
        <p className="text-sm text-gray-500 mt-1">Customer support and case management tools</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <Users className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{customerList.length}</p>
            <p className="text-sm text-gray-500">Customers</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-amber-100 rounded-lg w-fit">
            <Wrench className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">
              {woList.filter((w: any) => w.status !== 'COMPLETED' && w.status !== 'RESOLVED').length}
            </p>
            <p className="text-sm text-gray-500">Open Tickets</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-green-100 rounded-lg w-fit">
            <MessageSquare className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{woList.length}</p>
            <p className="text-sm text-gray-500">Total Cases</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search customers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        />
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Customer Directory</h3>
        </div>
        {filteredCustomers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No customers found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCustomers.slice(0, 15).map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.email || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.phone || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {c.status || '-'}
                    </span>
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
