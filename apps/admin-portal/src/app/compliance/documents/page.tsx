'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { documentsService } from '@bossnyumba/api-client';
import {
  FileText,
  Download,
  RefreshCw,
  AlertTriangle,
  Search,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useState } from 'react';

export default function ComplianceDocumentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const {
    data: documents,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin-compliance-documents'],
    queryFn: async () => {
      const res = await documentsService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load documents');
    },
    staleTime: 30_000,
  });

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
        <h2 className="text-lg font-semibold text-gray-900">Compliance Documents Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load documents.'}
        </p>
      </div>
    );
  }

  const docList = Array.isArray(documents) ? documents : [];
  const filteredDocs = docList.filter((d: any) =>
    (d.name || d.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compliance Documents</h1>
        <p className="text-sm text-gray-500 mt-1">Document management and compliance review</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <FileText className="h-5 w-5 text-violet-600" />
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
            <p className="text-2xl font-bold text-gray-900">
              {docList.filter((d: any) => d.status === 'APPROVED' || d.status === 'SIGNED').length}
            </p>
            <p className="text-sm text-gray-500">Approved</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-amber-100 rounded-lg w-fit">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">
              {docList.filter((d: any) => d.status === 'PENDING' || d.status === 'REVIEW').length}
            </p>
            <p className="text-sm text-gray-500">Pending Review</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        />
      </div>

      {/* Download Error */}
      {downloadError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {downloadError}
          <button onClick={() => setDownloadError(null)} className="ml-auto text-red-500 hover:text-red-700 text-xs font-medium">Dismiss</button>
        </div>
      )}

      {/* Documents Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredDocs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No documents found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDocs.map((doc: any) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-400" />
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
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={async () => {
                        setDownloadError(null);
                        try {
                          const res = await documentsService.get(doc.id);
                          if (res.success && res.data?.url) {
                            window.open(res.data.url, '_blank');
                          }
                        } catch {
                          setDownloadError(`Failed to download "${doc.name || doc.title || 'document'}". Please try again.`);
                        }
                      }}
                      className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                      <Download className="h-4 w-4" />
                    </button>
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
