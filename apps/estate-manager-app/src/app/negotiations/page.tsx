'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@bossnyumba/design-system';

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
  const [items, setItems] = useState<ReadonlyArray<Negotiation>>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // TODO: replace with real fetch to /api/negotiations for the manager's properties.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/negotiations');
        if (!cancelled && res.ok) {
          const data = (await res.json()) as ReadonlyArray<Negotiation>;
          setItems(data);
        }
      } catch {
        // swallow; leave items empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Negotiations</h1>
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
                <p className="text-sm">{n.customerName} · proposed {n.proposedRent.toLocaleString()} vs {n.askingRent.toLocaleString()}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm">Counter</Button>
                  <Button size="sm" variant="outline">Escalate to owner</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground">No active negotiations.</p>}
        </div>
      )}
    </main>
  );
}
