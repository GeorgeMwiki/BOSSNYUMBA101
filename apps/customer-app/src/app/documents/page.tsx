'use client';

import Link from 'next/link';
import { FileText, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface DocumentListItem {
  id: string;
  name: string;
  category: string;
  date: string;
  type: string;
}

// Document list is gated on the live documents API. Until wired,
// render the empty state rather than seeded entries.
const documents: DocumentListItem[] = [];

export default function DocumentsPage() {
  return (
    <>
      <PageHeader title="My Documents" showBack />

      <div className="px-4 py-4 space-y-4">
        <p className="text-sm text-gray-500 mb-4">
          Your lease, statements, and other documents.
        </p>
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
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">
                    {new Date(doc.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </Link>
          ))}
        </div>
        {documents.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No documents</h3>
            <p className="text-sm text-gray-500 mt-1">
              Your documents will appear here
            </p>
          </div>
        )}
      </div>
    </>
  );
}
