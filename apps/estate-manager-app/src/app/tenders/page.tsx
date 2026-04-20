'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Alert,
  AlertDescription,
  Skeleton,
  EmptyState,
} from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';

interface Tender {
  readonly id: string;
  readonly title: string;
  readonly scope: string;
  readonly bidCount: number;
  readonly deadline: string;
  readonly status: 'open' | 'reviewing' | 'awarded' | 'closed';
}

export default function TendersPage(): React.ReactElement {
  const t = useTranslations('tendersPage');
  const router = useRouter();
  const [tenders, setTenders] = useState<ReadonlyArray<Tender>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: wire /api/tenders endpoint (estate-manager scoped)
      const res = await fetch('/api/tenders', { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as ReadonlyArray<Tender>;
      if (!signal?.aborted) {
        setTenders(data);
        setLoading(false);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : t('failedLoad'));
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const openNewTender = useCallback(() => router.push('/tenders/new'), [router]);
  const reviewBids = useCallback(
    (id: string) => router.push(`/tenders/${id}/bids`),
    [router]
  );

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button onClick={openNewTender} aria-label={t('newTenderAria')}>
          {t('newTender')}
        </Button>
      </div>

      {error && (
        <Alert variant="danger">
          <AlertDescription>
            {error}
            <Button variant="link" size="sm" onClick={() => void load()} className="ml-2">
              {t('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-3" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : tenders.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDesc')}
          action={
            <Button onClick={openNewTender} aria-label={t('newTenderAria')}>
              {t('newTender')}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {tenders.map((tn) => (
            <Card key={tn.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{tn.title}</CardTitle>
                  <Badge>{tn.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{tn.scope}</p>
                <p className="text-xs mt-1">
                  {tn.bidCount === 1
                    ? t('bidLine', { count: tn.bidCount, date: new Date(tn.deadline).toLocaleDateString() })
                    : t('bidsLine', { count: tn.bidCount, date: new Date(tn.deadline).toLocaleDateString() })}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={tn.bidCount === 0}
                  title={tn.bidCount === 0 ? t('noBidsYet') : undefined}
                  onClick={() => reviewBids(tn.id)}
                  aria-label={t('reviewBidsAria', { title: tn.title })}
                >
                  {t('reviewBids')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
