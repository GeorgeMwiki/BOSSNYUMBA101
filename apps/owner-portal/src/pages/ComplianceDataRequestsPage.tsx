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
  EmptyState,
  Skeleton,
} from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { api, formatDate } from '../lib/api';

interface DataRequest {
  readonly id: string;
  readonly tenantId: string;
  readonly customerId: string;
  readonly status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'failed';
  readonly notes?: string;
  readonly createdAt: string;
  readonly executedAt?: string;
}

export default function ComplianceDataRequestsPage() {
  const t = useTranslations('complianceDataRequestsPage');
  const [requests, setRequests] = useState<ReadonlyArray<DataRequest>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ReadonlyArray<DataRequest>>('/gdpr/delete-requests');
      if (signal?.aborted) return;
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to load data requests');
        setLoading(false);
        return;
      }
      setRequests(res.data ?? []);
      setLoading(false);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load data requests');
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
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
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

      {!error && requests.length === 0 ? (
        <EmptyState title={t('title')} description={t('description')} />
      ) : null}

      <div className="grid gap-3">
        {requests.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Request {r.id}</CardTitle>
                <Badge>{r.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-gray-500">Customer</dt>
                  <dd className="font-medium text-gray-900">{r.customerId}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Created</dt>
                  <dd className="font-medium text-gray-900">{formatDate(r.createdAt)}</dd>
                </div>
                {r.executedAt ? (
                  <div>
                    <dt className="text-gray-500">Executed</dt>
                    <dd className="font-medium text-gray-900">{formatDate(r.executedAt)}</dd>
                  </div>
                ) : null}
              </dl>
              {r.notes ? (
                <p className="mt-3 text-sm text-gray-700">{r.notes}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
