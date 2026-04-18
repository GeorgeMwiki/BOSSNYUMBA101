'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Input } from '@bossnyumba/design-system';

/**
 * Excel-like arrears grid.
 * TODO: Replace this lightweight table with TanStack Table + virtualization,
 * column filters, row selection, bulk actions, CSV export.
 */

interface ArrearsRow {
  readonly id: string;
  readonly unitLabel: string;
  readonly tenantName: string;
  readonly monthsOverdue: number;
  readonly amountOwed: number;
  readonly lastPaymentDate: string | null;
  readonly riskTier: 'low' | 'medium' | 'high' | 'critical';
}

export default function ArrearsPage(): React.ReactElement {
  const [rows, setRows] = useState<ReadonlyArray<ArrearsRow>>([]);
  const [query, setQuery] = useState<string>('');

  useEffect(() => {
    // TODO: wire /api/payments/arrears
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/payments/arrears');
        if (!cancelled && res.ok) setRows((await res.json()) as ReadonlyArray<ArrearsRow>);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query) return rows;
    const q = query.toLowerCase();
    return rows.filter(
      (r) => r.unitLabel.toLowerCase().includes(q) || r.tenantName.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const total = filtered.reduce((sum, r) => sum + r.amountOwed, 0);

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Arrears Grid</h1>
        <div className="flex gap-2">
          <Input placeholder="Filter units or tenants..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <Button variant="outline">Export CSV</Button>
          <Button>Send reminders</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overdue balances — total {total.toLocaleString()}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Unit</th>
                  <th className="p-2 text-left">Tenant</th>
                  <th className="p-2 text-right">Months</th>
                  <th className="p-2 text-right">Owed</th>
                  <th className="p-2 text-left">Last payment</th>
                  <th className="p-2 text-left">Risk</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-accent/50">
                    <td className="p-2">{r.unitLabel}</td>
                    <td className="p-2">{r.tenantName}</td>
                    <td className="p-2 text-right">{r.monthsOverdue}</td>
                    <td className="p-2 text-right">{r.amountOwed.toLocaleString()}</td>
                    <td className="p-2">{r.lastPaymentDate ?? '—'}</td>
                    <td className="p-2"><Badge>{r.riskTier}</Badge></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No arrears.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
