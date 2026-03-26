'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { customersService, documentsService } from '@bossnyumba/api-client';
import {
  Shield,
  FileText,
  Users,
  Clock,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

export default function ComplianceDataRequestsPage() {
  const {
    data: customers,
    isLoading: loadingCustomers,
    error: customersError,
  } = useQuery({
    queryKey: ['admin-data-requests-customers'],
    queryFn: async () => {
      const res = await customersService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load customer data');
    },
    staleTime: 30_000,
  });

  const {
    data: documents,
    isLoading: loadingDocs,
    error: docsError,
  } = useQuery({
    queryKey: ['admin-data-requests-docs'],
    queryFn: async () => {
      const res = await documentsService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load documents');
    },
    staleTime: 30_000,
  });

  const isLoading = loadingCustomers || loadingDocs;
  const error = customersError || docsError;

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
        <h2 className="text-lg font-semibold text-gray-900">Data Requests Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load data request information.'}
        </p>
      </div>
    );
  }

  const customerList = Array.isArray(customers) ? customers : [];
  const docList = Array.isArray(documents) ? documents : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Data Subject Requests</h1>
        <p className="text-sm text-gray-500 mt-1">Privacy requests and compliance case management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <Users className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{customerList.length}</p>
            <p className="text-sm text-gray-500">Data Subjects</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{docList.length}</p>
            <p className="text-sm text-gray-500">Related Documents</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-green-100 rounded-lg w-fit">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-500">Requests Fulfilled</p>
          </div>
        </div>
      </div>

      {/* Data Subjects Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Data Subjects</h3>
        </div>
        {customerList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No data subject requests</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
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
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                      {c.status || 'Active'}
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
