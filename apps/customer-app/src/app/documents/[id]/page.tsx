'use client';

import { useParams } from 'next/navigation';
import { Download, FileText, AlertTriangle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@bossnyumba/api-client';

function DocumentSkeleton() {
  return (
    <div className="px-4 py-4 space-y-4 animate-pulse">
      <div className="card p-4">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 bg-gray-200 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-3 w-32 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
      <div className="h-12 bg-gray-200 rounded-xl" />
    </div>
  );
}

export default function DocumentViewerPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: document, isLoading, isError, refetch } = useQuery<any>(`/documents/${id}`);

  const handleDownload = () => {
    window.open(`/documents/${id}/download`, '_blank');
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Document" showBack />
        <DocumentSkeleton />
      </>
    );
  }

  if (isError || !document) {
    return (
      <>
        <PageHeader title="Document" showBack />
        <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
          <AlertTriangle className="w-12 h-12 text-warning-400 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Document not found</h2>
          <p className="text-gray-500 text-sm mb-6">Could not load this document.</p>
          <button onClick={() => refetch()} className="btn-primary px-6 py-2 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={document.name} showBack />
      <div className="px-4 py-4 space-y-4">
        <div className="card p-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-gray-100 rounded-lg">
              <FileText className="w-8 h-8 text-gray-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">{document.name}</h2>
              <div className="text-sm text-gray-500 mt-1">{document.category}</div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(document.date).toLocaleDateString()} · {(document.type || '').toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleDownload}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download document
          </button>
        </div>
      </div>
    </>
  );
}
