'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Badge,
  Alert,
  AlertDescription,
  Skeleton,
  EmptyState,
} from '@bossnyumba/design-system';

interface DamageLineItem {
  readonly id: string;
  readonly description: string;
  readonly managerAmount: number;
  readonly tenantCounterAmount?: number;
  readonly tenantNote?: string;
}

interface DamageProposal {
  readonly id: string;
  readonly leaseId: string;
  readonly items: ReadonlyArray<DamageLineItem>;
  readonly totalProposed: number;
  readonly depositOnHand: number;
}

export default function DamageDisputesPage(): React.ReactElement {
  const [proposal, setProposal] = useState<DamageProposal | null>(null);
  const [counters, setCounters] = useState<Record<string, { amount?: number; note?: string }>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      // TODO: wire GET /api/customer/lease/move-out/disputes (current active proposal)
      const res = await fetch('/api/customer/lease/move-out/disputes', { signal });
      if (res.status === 404) {
        if (!signal?.aborted) {
          setProposal(null);
          setLoading(false);
        }
        return;
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as DamageProposal;
      if (!signal?.aborted) {
        setProposal(data);
        setLoading(false);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setLoadError(err instanceof Error ? err.message : 'Failed to load damage proposal');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const updateCounter = useCallback(
    (itemId: string, patch: { amount?: number; note?: string }): void => {
      setCounters((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
    },
    []
  );

  const submit = useCallback(async (): Promise<void> => {
    if (!proposal) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      // TODO: wire POST /api/customer/lease/move-out/disputes
      const res = await fetch('/api/customer/lease/move-out/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id, counters }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setFeedback({ kind: 'success', message: 'Counter submitted.' });
    } catch (err) {
      setFeedback({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Submission failed',
      });
    } finally {
      setSubmitting(false);
    }
  }, [counters, proposal]);

  if (loading) {
    return (
      <main className="p-6 max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Damage proposal — counter / dispute</h1>
        <div className="space-y-3" aria-live="polite">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="p-6 max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Damage proposal — counter / dispute</h1>
        <Alert variant="danger">
          <AlertDescription>
            {loadError}
            <Button variant="link" size="sm" onClick={() => void load()} className="ml-2">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!proposal) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <EmptyState
          title="No active damage proposal"
          description="You have no open damage-deduction proposals from your landlord."
        />
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Damage proposal — counter / dispute</h1>
      {feedback && (
        <Alert variant={feedback.kind === 'success' ? 'success' : 'danger'}>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Proposed {proposal.totalProposed.toLocaleString()} · Deposit held {proposal.depositOnHand.toLocaleString()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {proposal.items.map((i) => (
            <div key={i.id} className="border rounded-md p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{i.description}</span>
                <Badge>Manager: {i.managerAmount.toLocaleString()}</Badge>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-2 mt-2">
                <Input
                  type="number"
                  placeholder="Your amount"
                  aria-label={`Your counter amount for ${i.description}`}
                  onChange={(e) => updateCounter(i.id, { amount: Number(e.target.value) })}
                />
                <Input
                  placeholder="Your note / evidence..."
                  aria-label={`Your note for ${i.description}`}
                  onChange={(e) => updateCounter(i.id, { note: e.target.value })}
                />
              </div>
            </div>
          ))}

          <Button
            onClick={submit}
            loading={submitting}
            disabled={submitting || Object.keys(counters).length === 0}
            title={Object.keys(counters).length === 0 ? 'Add at least one counter before submitting' : undefined}
            aria-label="Submit counter proposal"
          >
            Submit counter
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
