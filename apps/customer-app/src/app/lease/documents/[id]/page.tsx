'use client';

import { useParams } from 'next/navigation';
import { Download, AlertTriangle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@bossnyumba/api-client';

function LeaseDocumentSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="card p-4 space-y-3">
        <div className="h-4 w-40 bg-gray-200 rounded" />
        <div className="h-12 bg-gray-200 rounded-xl" />
      </div>
    </div>
  );
}

export default function LeaseDocumentPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: document, isLoading, isError, refetch } = useQuery<any>(`/lease/documents/${id}`);

  const handleDownload = () => {
    window.open(`/lease/documents/${id}/download`, '_blank');
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Document" showBack />
        <LeaseDocumentSkeleton />
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
      <div className="p-4 space-y-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-2">Date: {new Date(document.date).toLocaleDateString()}</p>
          <button onClick={handleDownload} className="btn-primary w-full flex items-center justify-center gap-2">
            <Download className="w-5 h-5" />
            Download document
          </button>
        </div>
      </div>
    </>
  );
}
