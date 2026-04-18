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

interface MoveOutInspection {
  readonly id: string;
  readonly unitLabel: string;
  readonly tenantName: string;
  readonly scheduledAt: string;
  readonly status: 'scheduled' | 'in_progress' | 'completed';
}

export default function MoveOutInspectionsPage(): React.ReactElement {
  const router = useRouter();
  const [items, setItems] = useState<ReadonlyArray<MoveOutInspection>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: wire /api/inspections/move-out
      const res = await fetch('/api/inspections/move-out', { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as ReadonlyArray<MoveOutInspection>;
      if (!signal?.aborted) {
        setItems(data);
        setLoading(false);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load move-out inspections');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const startInspection = useCallback(
    (id: string) => {
      router.push(`/inspections/move-out/${id}`);
    },
    [router]
  );

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Move-out Inspections</h1>

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
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No move-outs scheduled"
          description="Move-out inspections will appear here once leases approach expiry."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((i) => (
            <Card key={i.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{i.unitLabel}</CardTitle>
                  <Badge>{i.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">Tenant: {i.tenantName}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(i.scheduledAt).toLocaleString()}
                </p>
                <Button
                  size="sm"
                  className="mt-2"
                  disabled={i.status === 'completed'}
                  onClick={() => startInspection(i.id)}
                  aria-label={`Start move-out inspection for ${i.unitLabel}`}
                >
                  {i.status === 'in_progress' ? 'Resume inspection' : 'Start inspection'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
