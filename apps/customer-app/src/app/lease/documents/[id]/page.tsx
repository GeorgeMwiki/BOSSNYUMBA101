'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const documents: Record<string, { name: string; date: string }> = {
  '1': { name: 'Lease Agreement', date: '2023-05-28' },
  '2': { name: 'Move-in Inspection Report', date: '2023-06-01' },
  '3': { name: 'House Rules', date: '2023-05-28' },
};

export default function LeaseDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const doc = documents[id];

  const handleDownload = () => {
    // In production, would fetch PDF and trigger download
    window.open(`/lease/documents/${id}/download`, '_blank');
  };

  if (!doc) {
    return (
      <>
        <PageHeader title="Document" showBack />
        <div className="p-4">
          <p className="text-gray-500">Document not found.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={doc.name} showBack />
      <div className="p-4 space-y-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-2">Date: {new Date(doc.date).toLocaleDateString()}</p>
          <button onClick={handleDownload} className="btn-primary w-full flex items-center justify-center gap-2">
            <Download className="w-5 h-5" />
            Download document
          </button>
        </div>
      </div>
    </>
  );
}
