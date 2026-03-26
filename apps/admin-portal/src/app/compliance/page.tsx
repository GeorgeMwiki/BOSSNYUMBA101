'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { documentsService, tenantsService } from '@bossnyumba/api-client';
import {
  Shield,
  FileText,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Users,
} from 'lucide-react';

export default function CompliancePage() {
  const {
    data: documents,
    isLoading: loadingDocs,
    error: docsError,
  } = useQuery({
    queryKey: ['admin-compliance-overview-docs'],
    queryFn: async () => {
      const res = await documentsService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load documents');
    },
    staleTime: 30_000,
  });

  const {
    data: tenant,
    isLoading: loadingTenants,
    error: tenantsError,
  } = useQuery({
    queryKey: ['admin-compliance-overview-tenant'],
    queryFn: async () => {
      const res = await tenantsService.getCurrent();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load tenant');
    },
    staleTime: 30_000,
  });

  const isLoading = loadingDocs || loadingTenants;
  const error = docsError || tenantsError;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="space-y-2">
          <div className="h-7 bg-gray-200 rounded w-44" />
          <div className="h-4 bg-gray-200 rounded w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="h-9 w-9 bg-gray-200 rounded-lg" />
              <div className="h-7 bg-gray-200 rounded w-16 mt-4" />
              <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="h-5 bg-gray-200 rounded w-52" />
          </div>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-6 px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded w-36" />
              </div>
              <div className="h-4 bg-gray-200 rounded w-20" />
              <div className="h-5 bg-gray-200 rounded-full w-16" />
              <div className="h-4 bg-gray-200 rounded w-24" />
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
        <h2 className="text-lg font-semibold text-gray-900">Compliance Overview Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load compliance data. Please check your connection and try again.'}
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

  const docList = Array.isArray(documents) ? documents : [];
  const tenantName = tenant?.name || 'Current Tenant';

  const approvedDocs = docList.filter((d: any) => d.status === 'APPROVED' || d.status === 'SIGNED').length;
  const pendingDocs = docList.filter((d: any) => d.status === 'PENDING' || d.status === 'REVIEW').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compliance Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Compliance records and tenant review status</p>
      </div>

      {/* Compliance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <Shield className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{docList.length}</p>
            <p className="text-sm text-gray-500">Total Documents</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-green-100 rounded-lg w-fit">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{approvedDocs}</p>
            <p className="text-sm text-gray-500">Approved</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-amber-100 rounded-lg w-fit">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{pendingDocs}</p>
            <p className="text-sm text-gray-500">Pending Review</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{tenantName}</p>
            <p className="text-sm text-gray-500">Active Tenant</p>
          </div>
        </div>
      </div>

      {/* Recent Documents */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Recent Compliance Documents</h3>
        </div>
        {docList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-3 bg-gray-100 rounded-full mb-3">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No Compliance Documents</h3>
            <p className="text-sm text-gray-500 max-w-sm">Compliance documents will appear here once uploaded.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {docList.slice(0, 10).map((doc: any) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{doc.name || doc.title || doc.id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{doc.type || doc.category || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      doc.status === 'APPROVED' || doc.status === 'SIGNED' ? 'bg-green-100 text-green-700' :
                      doc.status === 'PENDING' || doc.status === 'REVIEW' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {doc.status || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '-'}
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
