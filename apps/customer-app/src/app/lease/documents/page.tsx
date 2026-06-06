'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Download, FileText } from 'lucide-react';
import { Skeleton, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, type DocumentRecord } from '@/lib/api';

/**
 * Document categories surfaced on the lease tab — the lease agreement
 * plus the records a tenant references against it (move-in/out reports,
 * notices). Categories come from the gateway's `mapCategory`.
 */
const LEASE_CATEGORIES = new Set(['leases', 'reports', 'compliance']);

export default function LeaseDocumentsPage() {
  const t = useTranslations('documentsList');
  const headers = useTranslations('pageHeaders');

  const documentsQuery = useQuery({
    queryKey: ['customer-documents'],
    queryFn: () => api.documents.list({ pageSize: 100 }),
  });

  const documents = (documentsQuery.data ?? []).filter((doc) =>
    LEASE_CATEGORIES.has(doc.category),
  );

  return (
    <>
      <PageHeader title={headers('leaseDocuments')} showBack />

      <div className="space-y-4 px-4 py-4">
        <p className="mb-2 text-sm text-gray-500">{t('leaseSubtitle')}</p>

        {documentsQuery.isError && (
          <Alert variant="danger">
            <AlertDescription>
              {(documentsQuery.error as Error).message}
              <Button size="sm" className="ml-2" onClick={() => documentsQuery.refetch()}>
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {documentsQuery.isLoading && (
          <div className="card divide-y divide-gray-100">
            {[0, 1, 2].map((i) => (
              <div key={i} className="p-4">
                <Skeleton className="h-5 w-48" />
              </div>
            ))}
          </div>
        )}

        {!documentsQuery.isLoading && !documentsQuery.isError && documents.length === 0 && (
          <div className="py-12 text-center">
            <FileText className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <h3 className="font-medium text-gray-900">{headers('noDocuments')}</h3>
            <p className="mt-1 text-sm text-gray-500">{t('emptyHint')}</p>
          </div>
        )}

        {documents.length > 0 && (
          <div className="card divide-y divide-gray-100">
            {documents.map((doc: DocumentRecord) => (
              <LeaseDocumentRow key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function LeaseDocumentRow({ doc }: { doc: DocumentRecord }) {
  const t = useTranslations('documentsList');
  const date = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : null;

  const content = (
    <>
      <div className="rounded-lg bg-gray-100 p-2">
        <FileText className="h-5 w-5 text-gray-600" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{doc.name}</div>
        {date && <div className="text-xs text-gray-500">{date}</div>}
      </div>
    </>
  );

  if (doc.url) {
    return (
      <a
        href={doc.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-4 transition-colors hover:bg-gray-50"
      >
        {content}
        <Download className="h-5 w-5 flex-shrink-0 text-gray-400" aria-label={t('download')} />
      </a>
    );
  }

  return <div className="flex items-center gap-3 p-4 opacity-70">{content}</div>;
}
