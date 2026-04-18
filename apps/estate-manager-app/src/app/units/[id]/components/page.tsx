'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  const router = useRouter();
  const unitId = params?.id as string;
  const [rows, setRows] = useState<ReadonlyArray<Component>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: wire /api/units/:id/components
      const res = await fetch(`/api/units/${unitId}/components`, { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as ReadonlyArray<Component>;
      if (!signal?.aborted) {
        setRows(data);
        setLoading(false);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load components');
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const handleAdd = useCallback(
    () => router.push(`/units/${unitId}/components/new`),
    [router, unitId]
  );
  const handleEdit = useCallback(
    (componentId: string) => router.push(`/units/${unitId}/components/${componentId}/edit`),
    [router, unitId]
  );

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Unit components — {unitId}</h1>
        <Button onClick={handleAdd} aria-label="Add new component">
          + Add component
        </Button>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Fixtures / Appliances / Rooms</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2" aria-live="polite">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No components recorded"
              description="Add fixtures, appliances, rooms or finishes to track condition and warranty."
              action={
                <Button onClick={handleAdd} aria-label="Add new component">
                  + Add component
                </Button>
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th scope="col" className="p-2 text-left">Category</th>
                  <th scope="col" className="p-2 text-left">Name</th>
                  <th scope="col" className="p-2 text-left">Condition</th>
                  <th scope="col" className="p-2 text-right">Age (mo)</th>
                  <th scope="col" className="p-2 text-left">Warranty ends</th>
                  <th scope="col" className="p-2"><span className="sr-only">Actions</span></th>
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
                    <td className="p-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(r.id)}
                        aria-label={`Edit ${r.name}`}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
