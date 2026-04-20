'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Input,
  Alert,
  AlertDescription,
  Skeleton,
  EmptyState,
} from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';

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

const CSV_HEADER = 'Unit,Tenant,Months Overdue,Amount Owed,Last Payment,Risk Tier\n';

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: ReadonlyArray<ArrearsRow>): string {
  const body = rows
    .map((r) =>
      [
        escapeCsv(r.unitLabel),
        escapeCsv(r.tenantName),
        String(r.monthsOverdue),
        String(r.amountOwed),
        escapeCsv(r.lastPaymentDate ?? ''),
        r.riskTier,
      ].join(',')
    )
    .join('\n');
  return CSV_HEADER + body;
}

export default function ArrearsPage(): React.ReactElement {
  const t = useTranslations('arrearsGrid');
  const [rows, setRows] = useState<ReadonlyArray<ArrearsRow>>([]);
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingReminders, setSendingReminders] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: wire /api/payments/arrears
      const res = await fetch('/api/payments/arrears', { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as ReadonlyArray<ArrearsRow>;
      if (!signal?.aborted) {
        setRows(data);
        setLoading(false);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : t('failedLoad'));
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const filtered = useMemo(() => {
    if (!query) return rows;
    const q = query.toLowerCase();
    return rows.filter(
      (r) => r.unitLabel.toLowerCase().includes(q) || r.tenantName.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const total = filtered.reduce((sum, r) => sum + r.amountOwed, 0);

  const handleExportCsv = useCallback(() => {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `arrears-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [filtered]);

  const handleSendReminders = useCallback(async () => {
    if (filtered.length === 0) return;
    setSendingReminders(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/payments/arrears/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: filtered.map((r) => r.id) }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setFeedback({
        kind: 'success',
        message: filtered.length === 1
          ? t('remindersQueuedOne', { count: filtered.length })
          : t('remindersQueued', { count: filtered.length }),
      });
    } catch (err) {
      setFeedback({
        kind: 'error',
        message: err instanceof Error ? err.message : t('failedRemind'),
      });
    } finally {
      setSendingReminders(false);
    }
  }, [filtered, t]);

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder={t('filterPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('filterAria')}
          />
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={filtered.length === 0 || loading}
            title={filtered.length === 0 ? t('nothingToExport') : undefined}
            aria-label={t('exportCsvAria')}
          >
            {t('exportCsv')}
          </Button>
          <Button
            onClick={handleSendReminders}
            loading={sendingReminders}
            disabled={filtered.length === 0 || loading || sendingReminders}
            title={filtered.length === 0 ? t('noTenantsRemind') : undefined}
            aria-label={t('sendRemindersAria')}
          >
            {t('sendReminders')}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger">
          <AlertDescription>
            {error}
            <Button variant="link" size="sm" onClick={() => void load()} className="ml-2">
              {t('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {feedback && (
        <Alert variant={feedback.kind === 'success' ? 'success' : 'danger'}>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('totalLabel', { total: total.toLocaleString() })}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2" aria-live="polite">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={query ? t('emptyTitleNoMatch') : t('emptyTitleNoArrears')}
              description={
                query
                  ? t('emptyDescNoMatch')
                  : t('emptyDescNoArrears')
              }
              action={
                query ? (
                  <Button variant="outline" onClick={() => setQuery('')}>
                    {t('clearFilter')}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-muted">
                  <tr>
                    <th scope="col" className="p-2 text-left">{t('colUnit')}</th>
                    <th scope="col" className="p-2 text-left">{t('colTenant')}</th>
                    <th scope="col" className="p-2 text-right">{t('colMonths')}</th>
                    <th scope="col" className="p-2 text-right">{t('colOwed')}</th>
                    <th scope="col" className="p-2 text-left">{t('colLastPayment')}</th>
                    <th scope="col" className="p-2 text-left">{t('colRisk')}</th>
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
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
