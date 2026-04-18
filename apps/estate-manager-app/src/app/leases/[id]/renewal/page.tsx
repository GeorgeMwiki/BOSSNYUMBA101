'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Label,
  Badge,
  Alert,
  AlertDescription,
  Skeleton,
} from '@bossnyumba/design-system';

interface RenewalProposal {
  readonly leaseId: string;
  readonly currentRent: number;
  readonly proposedRent: number;
  readonly renewalTermMonths: number;
  readonly tenantAcceptance: 'pending' | 'accepted' | 'rejected' | 'countered';
  readonly expiryDate: string;
}

export default function LeaseRenewalPage(): React.ReactElement {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<RenewalProposal | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [proposedRent, setProposedRent] = useState<string>('');
  const [termMonths, setTermMonths] = useState<string>('12');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      // TODO: wire GET /api/leases/:id/renewal endpoint
      const res = await fetch(`/api/leases/${id}/renewal`, { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const d = (await res.json()) as RenewalProposal;
      if (!signal?.aborted) {
        setData(d);
        setProposedRent(String(d.proposedRent));
        setTermMonths(String(d.renewalTermMonths));
        setLoading(false);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setLoadError(err instanceof Error ? err.message : 'Failed to load lease');
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const submit = useCallback(async (): Promise<void> => {
    const rentNum = Number(proposedRent);
    const termNum = Number(termMonths);
    if (!Number.isFinite(rentNum) || rentNum <= 0) {
      setFeedback({ kind: 'error', message: 'Proposed rent must be a positive number.' });
      return;
    }
    if (!Number.isFinite(termNum) || termNum <= 0 || !Number.isInteger(termNum)) {
      setFeedback({ kind: 'error', message: 'Term must be a positive whole number of months.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      // TODO: wire POST /api/leases/:id/renewal
      const res = await fetch(`/api/leases/${id}/renewal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposedRent: rentNum, termMonths: termNum }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setFeedback({ kind: 'success', message: 'Proposal sent to tenant.' });
    } catch (err) {
      setFeedback({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to send proposal',
      });
    } finally {
      setSubmitting(false);
    }
  }, [id, proposedRent, termMonths]);

  return (
    <main className="p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Lease Renewal — {id}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadError && (
            <Alert variant="danger">
              <AlertDescription>
                {loadError}
                <Button variant="link" size="sm" onClick={() => void load()} className="ml-2">
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {feedback && (
            <Alert variant={feedback.kind === 'success' ? 'success' : 'danger'}>
              <AlertDescription>{feedback.message}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="space-y-2" aria-live="polite">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : data ? (
            <>
              <p className="text-sm">
                Current rent: <strong>{data.currentRent.toLocaleString()}</strong>
              </p>
              <p className="text-sm">
                Lease expires: {new Date(data.expiryDate).toLocaleDateString()}
              </p>
              <p className="text-sm">
                Tenant acceptance: <Badge>{data.tenantAcceptance}</Badge>
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Lease data unavailable.</p>
          )}

          <div>
            <Label htmlFor="rent">Proposed rent</Label>
            <Input
              id="rent"
              type="number"
              min={0}
              value={proposedRent}
              onChange={(e) => setProposedRent(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="term">Renewal term (months)</Label>
            <Input
              id="term"
              type="number"
              min={1}
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
            />
          </div>
          <Button
            onClick={submit}
            loading={submitting}
            disabled={submitting || loading}
            aria-label="Send renewal proposal to tenant"
          >
            Send proposal to tenant
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
