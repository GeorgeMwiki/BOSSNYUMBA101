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

interface Tender {
  readonly id: string;
  readonly title: string;
  readonly scope: string;
  readonly bidCount: number;
  readonly deadline: string;
  readonly status: 'open' | 'reviewing' | 'awarded' | 'closed';
}

export default function TendersPage(): React.ReactElement {
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
      setError(err instanceof Error ? err.message : 'Failed to load tenders');
      setLoading(false);
    }
  }, []);

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
        <h1 className="text-2xl font-semibold">Tenders</h1>
        <Button onClick={openNewTender} aria-label="Create new tender">
          + New tender
        </Button>
      </div>

      {error && (
        <Alert variant="danger">
          <AlertDescription>
            {error}
            <Button variant="link" size="sm" onClick={() => void load()} className="ml-2">
              Retry
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
          title="No tenders yet"
          description="Post a tender to solicit bids from your vendor network."
          action={
            <Button onClick={openNewTender} aria-label="Create new tender">
              + New tender
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {tenders.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t.title}</CardTitle>
                  <Badge>{t.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t.scope}</p>
                <p className="text-xs mt-1">
                  {t.bidCount} {t.bidCount === 1 ? 'bid' : 'bids'} · closes{' '}
                  {new Date(t.deadline).toLocaleDateString()}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={t.bidCount === 0}
                  title={t.bidCount === 0 ? 'No bids submitted yet' : undefined}
                  onClick={() => reviewBids(t.id)}
                  aria-label={`Review bids for ${t.title}`}
                >
                  Review bids
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
