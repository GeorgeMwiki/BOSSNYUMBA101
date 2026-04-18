import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@bossnyumba/design-system';
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

export const SurveyApprovalsQueue: React.FC = () => {
  const [items, setItems] = useState<ReadonlyArray<ConditionalSurvey>>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // TODO: wire GET /owner/conditional-surveys?status=pending
      const res = await api.get?.<ReadonlyArray<ConditionalSurvey>>('/owner/conditional-surveys?status=pending');
      if (!cancelled) {
        setItems(res?.data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const decide = async (id: string, decision: 'approve' | 'reject'): Promise<void> => {
    // TODO: wire POST /owner/conditional-surveys/:id/:decision
    await api.post?.(`/owner/conditional-surveys/${id}/${decision}`, {});
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Conditional Survey Approvals</h1>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Queue clear.</p>
      ) : (
        <div className="grid gap-3">
          {items.map((s) => (
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
                  <Button size="sm" onClick={() => decide(s.id, 'approve')}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => decide(s.id, 'reject')}>Reject</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SurveyApprovalsQueue;
