'use client';

import Link from 'next/link';
import { FileText, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const documents = [
  { id: '1', name: 'Lease Agreement', date: '2023-05-28', type: 'pdf' },
  { id: '2', name: 'Move-in Inspection Report', date: '2023-06-01', type: 'pdf' },
  { id: '3', name: 'House Rules', date: '2023-05-28', type: 'pdf' },
];

export default function LeaseDocumentsPage() {
  return (
    <>
      <PageHeader title="Lease Documents" showBack />

      <div className="px-4 py-4 space-y-4">
        <p className="text-sm text-gray-500 mb-4">
          Download your lease-related documents below.
        </p>
        <div className="card divide-y divide-gray-100">
          {documents.map((doc) => (
            <Link
              key={doc.id}
              href={`/lease/documents/${doc.id}`}
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
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
