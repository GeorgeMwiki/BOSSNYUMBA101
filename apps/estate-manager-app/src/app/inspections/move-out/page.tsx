'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@bossnyumba/design-system';

interface MoveOutInspection {
  readonly id: string;
  readonly unitLabel: string;
  readonly tenantName: string;
  readonly scheduledAt: string;
  readonly status: 'scheduled' | 'in_progress' | 'completed';
}

export default function MoveOutInspectionsPage(): React.ReactElement {
  const [items, setItems] = useState<ReadonlyArray<MoveOutInspection>>([]);

  useEffect(() => {
    // TODO: wire /api/inspections/move-out
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/inspections/move-out');
        if (!cancelled && res.ok) setItems((await res.json()) as ReadonlyArray<MoveOutInspection>);
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
      <h1 className="text-2xl font-semibold">Move-out Inspections</h1>
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
              <Button size="sm" className="mt-2">Start inspection</Button>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No move-outs scheduled.</p>}
      </div>
    </main>
  );
}
