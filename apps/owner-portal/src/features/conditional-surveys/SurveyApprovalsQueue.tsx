import React, { useCallback, useEffect, useState } from 'react';
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
import { api } from '../../lib/api';

export interface ConditionalSurvey {
  readonly id: string;
  readonly unitLabel: string;
  readonly triggeredBy: string; // e.g., 'move-in', 'maintenance'
  readonly severityEstimate: 'minor' | 'moderate' | 'major';
  readonly estimatedCost: number;
  readonly submittedAt: string;
  readonly submittedBy: string;
}

type SurveyDecision = 'approve' | 'reject';
type PendingDecision = { readonly id: string; readonly decision: SurveyDecision };

export const SurveyApprovalsQueue: React.FC = () => {
  const [items, setItems] = useState<ReadonlyArray<ConditionalSurvey>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDecision | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      // TODO: wire GET /owner/conditional-surveys?status=pending
      const res = await api.get?.<ReadonlyArray<ConditionalSurvey>>(
        '/owner/conditional-surveys?status=pending'
      );
      if (!signal?.aborted) {
        setItems(res?.data ?? []);
        setLoading(false);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load survey queue');
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const decide = useCallback(async (id: string, decision: SurveyDecision): Promise<void> => {
    setActError(null);
    setPending({ id, decision });
    try {
      // TODO: wire POST /owner/conditional-surveys/:id/:decision
      await api.post?.(`/owner/conditional-surveys/${id}/${decision}`, {});
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setActError(err instanceof Error ? err.message : `Failed to ${decision} survey`);
    } finally {
      setPending(null);
    }
  }, []);

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Conditional Survey Approvals</h1>
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
      {actError && (
        <Alert variant="danger">
          <AlertDescription>{actError}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-3" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Queue clear"
          description="No conditional surveys are awaiting your approval."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((s) => {
            const isPending = pending?.id === s.id;
            return (
              <Card key={s.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{s.unitLabel}</CardTitle>
                    <Badge>{s.severityEstimate}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">Trigger: {s.triggeredBy}</p>
                  <p className="text-sm">Estimated cost: {s.estimatedCost.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    Submitted by {s.submittedBy} · {new Date(s.submittedAt).toLocaleString()}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      loading={isPending && pending?.decision === 'approve'}
                      disabled={isPending}
                      onClick={() => decide(s.id, 'approve')}
                      aria-label={`Approve survey for ${s.unitLabel}`}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      loading={isPending && pending?.decision === 'reject'}
                      disabled={isPending}
                      onClick={() => decide(s.id, 'reject')}
                      aria-label={`Reject survey for ${s.unitLabel}`}
                    >
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SurveyApprovalsQueue;
