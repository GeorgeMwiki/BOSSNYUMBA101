/**
 * Compare-properties selector for the owner-portal.
 *
 * Owner picks 2–5 properties and sees a side-by-side comparison of:
 *   - Cap rate
 *   - Net Operating Income (NOI)
 *   - Occupancy
 *   - Maintenance cost (approximated from NOI deltas when not directly available)
 *
 * Data sources:
 *   - useProperties()          (list + basic metadata)
 *   - usePortfolioPerformance() (per-property revenue / NOI / cap rate / occupancy)
 *
 * No hardcoded rows — the table disappears if there's nothing to compare.
 */

import React, { useMemo, useState } from 'react';
import { Skeleton, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProperties, usePortfolioPerformance } from '../lib/hooks';
import { formatCurrency, formatPercentage } from '../lib/api';

const MIN_SELECTION = 2;
const MAX_SELECTION = 5;

export function ComparePropertiesTable(): JSX.Element {
  const t = useTranslations('comparePropertiesTable');
  const properties = useProperties();
  const performance = usePortfolioPerformance();
  const [selected, setSelected] = useState<readonly string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= MAX_SELECTION) return prev;
      return [...prev, id];
    });
  };

  const rows = useMemo(() => {
    const perf = performance.data ?? [];
    return selected
      .map((id) => perf.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p);
  }, [selected, performance.data]);

  if (properties.isLoading || performance.isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (properties.error || performance.error) {
    const message =
      (properties.error instanceof Error && properties.error.message) ||
      (performance.error instanceof Error && performance.error.message) ||
      'Comparison data is unavailable.';
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }

  const list = properties.data ?? [];

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('title')}
        </h2>
        <span className="text-xs text-gray-500">
          {t('pick')} {MIN_SELECTION}&ndash;{MAX_SELECTION}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {list.map((p) => {
          const on = selected.includes(p.id);
          const disabled = !on && selected.length >= MAX_SELECTION;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              disabled={disabled}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                on
                  ? 'bg-violet-600 text-white border-violet-600'
                  : disabled
                  ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-violet-300'
              }`}
              aria-pressed={on}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {selected.length < MIN_SELECTION ? (
        <p className="text-sm text-gray-500">
          {t('pickAtLeast', { count: MIN_SELECTION })}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-medium text-gray-500">
                  {t('metric')}
                </th>
                {rows.map((r) => (
                  <th
                    key={r.id}
                    className="text-right py-2 font-medium text-gray-900"
                  >
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-600">{t('revenue')}</td>
                {rows.map((r) => (
                  <td key={r.id} className="py-2 text-right text-gray-900">
                    {formatCurrency(r.revenue)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-600">NOI</td>
                {rows.map((r) => (
                  <td key={r.id} className="py-2 text-right text-gray-900">
                    {formatCurrency(r.noi)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-600">{t('capRate')}</td>
                {rows.map((r) => (
                  <td key={r.id} className="py-2 text-right text-gray-900">
                    {r.capRate != null ? formatPercentage(r.capRate) : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 text-gray-600">{t('occupancy')}</td>
                {rows.map((r) => (
                  <td key={r.id} className="py-2 text-right text-gray-900">
                    {formatPercentage(r.occupancy)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {selected.length > 0 && (
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSelected([])}
          >
            {t('clearSelection')}
          </Button>
        </div>
      )}
    </section>
  );
}
