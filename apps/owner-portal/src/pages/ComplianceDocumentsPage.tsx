import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@bossnyumba/design-system';
import { EmptyState } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { api, formatDate } from '../lib/api';

type DocumentVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

interface ComplianceDocument {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly mimeType: string;
  readonly size: number;
  readonly url: string;
  readonly verificationStatus: DocumentVerificationStatus;
  readonly verifiedAt?: string;
  readonly tags: ReadonlyArray<string>;
  readonly createdAt: string;
}

const COMPLIANCE_TYPES: ReadonlyArray<string> = ['CONTRACT', 'LEASE', 'OTHER'];

export default function ComplianceDocumentsPage() {
  const t = useTranslations('complianceDocumentsPage');
  const [docs, setDocs] = useState<ReadonlyArray<ComplianceDocument>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch each compliance-relevant type in parallel and merge.
      const responses = await Promise.all(
        COMPLIANCE_TYPES.map((type) =>
          api.get<ReadonlyArray<ComplianceDocument>>(
            `/documents?type=${encodeURIComponent(type)}&pageSize=50`,
          ),
        ),
      );
      if (signal?.aborted) return;

      const failed = responses.find((r) => !r.success);
      if (failed) {
        setError(failed.error?.message ?? 'Failed to load compliance documents');
        setLoading(false);
        return;
      }

      const merged = responses.flatMap((r) => r.data ?? []);
      // de-dup by id (immutable Set-based reduce)
      const seen = new Set<string>();
      const unique = merged.filter((d) => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
      });
      setDocs(unique);
      setLoading(false);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load compliance documents');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <Skeleton className="h-10 w-64" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500">{t('description')}</p>
      </div>

      {error ? (
        <Alert variant="danger">
          <AlertDescription>
            {error}
            <Button size="sm" onClick={() => void load()} className="ml-2">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!error && docs.length === 0 ? (
        <EmptyState
          title={t('title')}
          description={t('description')}
        />
      ) : null}

      <div className="grid gap-3">
        {docs.map((d) => (
          <Card key={d.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{d.name}</CardTitle>
                <Badge>{d.verificationStatus}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <dt className="text-gray-500">Type</dt>
                  <dd className="font-medium text-gray-900">{d.type}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Created</dt>
                  <dd className="font-medium text-gray-900">{formatDate(d.createdAt)}</dd>
                </div>
                {d.verifiedAt ? (
                  <div>
                    <dt className="text-gray-500">Verified</dt>
                    <dd className="font-medium text-gray-900">{formatDate(d.verifiedAt)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-gray-500">Size</dt>
                  <dd className="font-medium text-gray-900">{Math.round(d.size / 1024)} KB</dd>
                </div>
              </dl>
              {d.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {d.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <div className="mt-3">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Open
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
