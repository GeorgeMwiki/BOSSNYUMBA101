'use client';

import { useParams } from 'next/navigation';
import { Download, FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const documents: Record<
  string,
  { name: string; category: string; date: string; type: string }
> = {
  '1': {
    name: 'Lease Agreement',
    category: 'Lease',
    date: '2023-05-28',
    type: 'pdf',
  },
  '2': {
    name: 'Move-in Inspection Report',
    category: 'Lease',
    date: '2023-06-01',
    type: 'pdf',
  },
  '3': {
    name: 'February 2024 Statement',
    category: 'Payment',
    date: '2024-02-01',
    type: 'pdf',
  },
  '4': {
    name: 'House Rules',
    category: 'Lease',
    date: '2023-05-28',
    type: 'pdf',
  },
};

export default function DocumentViewerPage() {
  const params = useParams();
  const id = params.id as string;
  const doc = documents[id];

  const handleDownload = () => {
    window.open(`/documents/${id}/download`, '_blank');
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
      <div className="px-4 py-4 space-y-4">
        <div className="card p-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-gray-100 rounded-lg">
              <FileText className="w-8 h-8 text-gray-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">{doc.name}</h2>
              <div className="text-sm text-gray-500 mt-1">{doc.category}</div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(doc.date).toLocaleDateString()} · {doc.type.toUpperCase()}
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
