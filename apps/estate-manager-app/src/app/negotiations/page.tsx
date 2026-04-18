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

interface Negotiation {
  readonly id: string;
  readonly unitLabel: string;
  readonly customerName: string;
  readonly proposedRent: number;
  readonly askingRent: number;
  readonly status: string;
  readonly lastMessageAt: string;
}

export default function NegotiationsPage(): React.ReactElement {
  const router = useRouter();
  const [items, setItems] = useState<ReadonlyArray<Negotiation>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [escalating, setEscalating] = useState<string | null>(null);
  const [escalateError, setEscalateError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: replace with real fetch to /api/negotiations for the manager's properties.
      const res = await fetch('/api/negotiations', { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as ReadonlyArray<Negotiation>;
      if (!signal?.aborted) {
        setItems(data);
        setLoading(false);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load negotiations');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const handleCounter = useCallback(
    (id: string) => router.push(`/negotiations/${id}`),
    [router]
  );

  const handleEscalate = useCallback(async (id: string): Promise<void> => {
    setEscalating(id);
    setEscalateError(null);
    try {
      const res = await fetch(`/api/negotiations/${id}/escalate`, { method: 'POST' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      // Immutable update — mark as escalated locally.
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'escalated' } : n))
      );
    } catch (err) {
      setEscalateError(err instanceof Error ? err.message : 'Failed to escalate');
    } finally {
      setEscalating(null);
    }
  }, []);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Negotiations</h1>

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

      {escalateError && (
        <Alert variant="danger">
          <AlertDescription>{escalateError}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-3" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No active negotiations"
          description="Active rent negotiations for your managed units will appear here."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((n) => (
            <Card key={n.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{n.unitLabel}</CardTitle>
                  <Badge>{n.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {n.customerName} · proposed {n.proposedRent.toLocaleString()} vs{' '}
                  {n.askingRent.toLocaleString()}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleCounter(n.id)}
                    aria-label={`Counter proposal for ${n.unitLabel}`}
                  >
                    Counter
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={escalating === n.id}
                    disabled={escalating === n.id || n.status === 'escalated'}
                    onClick={() => handleEscalate(n.id)}
                    aria-label={`Escalate ${n.unitLabel} to owner`}
                  >
                    {n.status === 'escalated' ? 'Escalated' : 'Escalate to owner'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
