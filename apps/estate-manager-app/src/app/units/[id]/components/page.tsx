'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@bossnyumba/design-system';

/**
 * FAR (Fixtures, Appliances, Rooms) grid for a unit.
 * Each row represents a named component with condition, age, and warranty info.
 */

interface Component {
  readonly id: string;
  readonly category: 'fixture' | 'appliance' | 'room' | 'finish';
  readonly name: string;
  readonly condition: 'new' | 'good' | 'fair' | 'poor' | 'broken';
  readonly ageMonths: number;
  readonly warrantyExpiresAt: string | null;
}

export default function UnitComponentsPage(): React.ReactElement {
  const params = useParams();
  const unitId = params?.id as string;
  const [rows, setRows] = useState<ReadonlyArray<Component>>([]);

  useEffect(() => {
    // TODO: wire /api/units/:id/components
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/units/${unitId}/components`);
        if (!cancelled && res.ok) setRows((await res.json()) as ReadonlyArray<Component>);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Unit components — {unitId}</h1>
        <Button>+ Add component</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fixtures / Appliances / Rooms</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">Category</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Condition</th>
                <th className="p-2 text-right">Age (mo)</th>
                <th className="p-2 text-left">Warranty ends</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="p-2"><Badge>{r.category}</Badge></td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{r.condition}</td>
                  <td className="p-2 text-right">{r.ageMonths}</td>
                  <td className="p-2">{r.warrantyExpiresAt ?? '—'}</td>
                  <td className="p-2"><Button size="sm" variant="outline">Edit</Button></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No components recorded.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </main>
  );
}
