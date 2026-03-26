'use client';

import Link from 'next/link';
import { FileText, ChevronRight, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@bossnyumba/api-client';

interface Document {
  id: string;
  name: string;
  category: string;
  date: string;
  type: string;
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

export default function DocumentsPage() {
  const { data: documents, isLoading, isError, refetch } = useQuery<Document[]>('/documents');

  return (
    <>
      <PageHeader title="My Documents" showBack />

      {isLoading ? (
        <DocumentsSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
          <AlertTriangle className="w-12 h-12 text-warning-400 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Failed to load documents</h2>
          <p className="text-gray-500 text-sm mb-6">Could not load your documents.</p>
          <button onClick={() => refetch()} className="btn-primary px-6 py-2">Retry</button>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-4">
          <p className="text-sm text-gray-500 mb-4">
            Your lease, statements, and other documents.
          </p>
          {documents && documents.length > 0 ? (
            <div className="card divide-y divide-gray-100">
              {documents.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <FileText className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{doc.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{doc.category}</span>
                      <span className="text-xs text-gray-400">&middot;</span>
                      <span className="text-xs text-gray-500">
                        {new Date(doc.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900">No documents</h3>
              <p className="text-sm text-gray-500 mt-1">
                Your documents will appear here
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
