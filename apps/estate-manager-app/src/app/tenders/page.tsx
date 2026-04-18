'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@bossnyumba/design-system';

interface Tender {
  readonly id: string;
  readonly title: string;
  readonly scope: string;
  readonly bidCount: number;
  readonly deadline: string;
  readonly status: 'open' | 'reviewing' | 'awarded' | 'closed';
}

export default function TendersPage(): React.ReactElement {
  const [tenders, setTenders] = useState<ReadonlyArray<Tender>>([]);

  useEffect(() => {
    // TODO: wire /api/tenders endpoint (estate-manager scoped)
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tenders');
        if (!cancelled && res.ok) setTenders((await res.json()) as ReadonlyArray<Tender>);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tenders</h1>
        <Button>+ New tender</Button>
      </div>
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
                {t.bidCount} bids · closes {new Date(t.deadline).toLocaleDateString()}
              </p>
              <Button size="sm" variant="outline" className="mt-2">
                Review bids
              </Button>
            </CardContent>
          </Card>
        ))}
        {tenders.length === 0 && <p className="text-sm text-muted-foreground">No tenders yet.</p>}
      </div>
    </main>
  );
}
