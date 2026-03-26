'use client';

import { AlertTriangle, FileText, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@bossnyumba/api-client';

interface LeaseDocument {
  id: string;
  name: string;
  date: string;
  type: string;
  downloadUrl?: string;
}

function DocumentsSkeleton() {
  return (
    <div className="px-4 py-4 space-y-4 animate-pulse">
      <div className="h-4 w-48 bg-gray-200 rounded" />
      <div className="card divide-y divide-gray-100">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-200 rounded-lg" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LeaseDocumentsPage() {
  const { data: documents, isLoading, isError, refetch } = useQuery<LeaseDocument[]>('/lease/documents');

  return (
    <>
      <PageHeader title="Lease Documents" showBack />

      {isLoading ? (
        <DocumentsSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
          <AlertTriangle className="w-12 h-12 text-warning-400 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Failed to load documents</h2>
          <p className="text-gray-500 text-sm mb-6">Could not load your lease documents.</p>
          <button onClick={() => refetch()} className="btn-primary px-6 py-2">Retry</button>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-4">
          <p className="text-sm text-gray-500 mb-4">
            Download your lease-related documents below.
          </p>

          {documents && documents.length > 0 ? (
            <div className="card divide-y divide-gray-100">
              {documents.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.downloadUrl || `/lease/documents/${doc.id}`}
                  target={doc.downloadUrl ? '_blank' : undefined}
                  rel={doc.downloadUrl ? 'noopener noreferrer' : undefined}
                  className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <FileText className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{doc.name}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(doc.date).toLocaleDateString()}
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </a>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900">No documents</h3>
              <p className="text-sm text-gray-500 mt-1">Your lease documents will appear here</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
