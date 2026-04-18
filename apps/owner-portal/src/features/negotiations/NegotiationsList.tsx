import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Alert, AlertDescription } from '@bossnyumba/design-system';
import { api } from '../../lib/api';

export interface Negotiation {
  readonly id: string;
  readonly unitId: string;
  readonly unitLabel: string;
  readonly customerName: string;
  readonly proposedRent: number;
  readonly askingRent: number;
  readonly status: 'pending' | 'countered' | 'accepted' | 'rejected' | 'expired';
  readonly lastMessageAt: string;
}

export const NegotiationsList: React.FC = () => {
  const [items, setItems] = useState<ReadonlyArray<Negotiation>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // TODO: wire GET /owner/negotiations endpoint.
        const res = await api.get?.<ReadonlyArray<Negotiation>>('/owner/negotiations');
        if (!cancelled) {
          setItems(res?.data ?? []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const act = async (id: string, action: 'accept' | 'override' | 'reject'): Promise<void> => {
    // TODO: wire POST /owner/negotiations/:id/:action
    try {
      await api.post?.(`/owner/negotiations/${id}/${action}`, {});
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Live Negotiations</h1>
      {error && <Alert variant="danger"><AlertDescription>{error}</AlertDescription></Alert>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
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
                <p className="text-sm">Prospect: <span className="font-medium">{n.customerName}</span></p>
                <p className="text-sm">
                  Proposed: <strong>{n.proposedRent.toLocaleString()}</strong> vs asking{' '}
                  {n.askingRent.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last message: {new Date(n.lastMessageAt).toLocaleString()}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => act(n.id, 'accept')}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => act(n.id, 'override')}>Override</Button>
                  <Button size="sm" variant="destructive" onClick={() => act(n.id, 'reject')}>Reject</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground">No active negotiations.</p>}
        </div>
      )}
    </div>
  );
};

export default NegotiationsList;
