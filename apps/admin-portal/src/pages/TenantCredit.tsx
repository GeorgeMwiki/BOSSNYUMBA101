/**
 * Tenant credit admin page — landlord-facing FICO-scale risk view.
 *
 * Lists every tenant (customer) with their current credit rating, filters
 * by band, and offers click-through to a detail panel with dimension
 * breakdown, promise outcomes, and 24-month history.
 *
 * Backed by:
 *   GET /api/v1/credit-rating/tenants/:customerId
 *   GET /api/v1/credit-rating/tenants/:customerId/history?months=24
 *   POST /api/v1/credit-rating/tenants/:customerId/recompute
 *   POST /api/v1/credit-rating/tenants/:customerId/record-promise-outcome
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BarChart3, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';

type Band =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'very_poor'
  | 'insufficient_data';

interface DimensionScore {
  readonly score: number;
  readonly weight: number;
  readonly explanation: string;
}

interface CreditRating {
  readonly tenantId: string;
  readonly customerId: string;
  readonly numericScore: number | null;
  readonly letterGrade: 'A' | 'B' | 'C' | 'D' | 'F' | null;
  readonly band: Band;
  readonly dimensions: {
    readonly payment_history: DimensionScore;
    readonly promise_keeping: DimensionScore;
    readonly rent_to_income: DimensionScore;
    readonly tenancy_length: DimensionScore;
    readonly dispute_history: DimensionScore;
  };
  readonly weakestFactor: string | null;
  readonly strongestFactor: string | null;
  readonly recommendations: readonly string[];
  readonly lastComputedAt: string;
  readonly dataFreshness: 'fresh' | 'stale' | 'unknown';
  readonly insufficientDataReason: string | null;
}

interface CustomerRow {
  readonly id: string;
  readonly name?: string;
  readonly email?: string;
}

const BAND_COLORS: Record<Band, string> = {
  excellent: 'bg-emerald-100 text-emerald-800',
  good: 'bg-green-100 text-green-800',
  fair: 'bg-yellow-100 text-yellow-800',
  poor: 'bg-orange-100 text-orange-800',
  very_poor: 'bg-red-100 text-red-800',
  insufficient_data: 'bg-gray-100 text-gray-700',
};

function useBandLabels(): Record<Band, string> {
  const t = useTranslations('tenantCredit');
  return {
    excellent: t('bands.excellent'),
    good: t('bands.good'),
    fair: t('bands.fair'),
    poor: t('bands.poor'),
    very_poor: t('bands.veryPoor'),
    insufficient_data: t('bands.insufficient'),
  };
}

export default function TenantCredit(): JSX.Element {
  const t = useTranslations('tenantCredit');
  const BAND_LABEL = useBandLabels();
  const [customers, setCustomers] = useState<readonly CustomerRow[]>([]);
  const [ratings, setRatings] = useState<
    Readonly<Record<string, CreditRating | 'error'>>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bandFilter, setBandFilter] = useState<Band | 'all'>('all');
  const [search, setSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<readonly CustomerRow[]>('/customers?limit=500');
    if (res.success && res.data) setCustomers(res.data);
    else setError(res.error ?? t('errors.loadFailed'));
    setLoading(false);
  }, [t]);

  const loadRating = useCallback(async (customerId: string): Promise<void> => {
    const res = await api.get<CreditRating>(
      `/credit-rating/tenants/${encodeURIComponent(customerId)}`,
    );
    setRatings((prev) => ({
      ...prev,
      [customerId]: res.success && res.data ? res.data : 'error',
    }));
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    for (const c of customers) {
      if (!(c.id in ratings)) void loadRating(c.id);
    }
  }, [customers, ratings, loadRating]);

  const visible = useMemo(() => {
    return customers.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        const name = (c.name ?? c.email ?? c.id).toLowerCase();
        if (!name.includes(q)) return false;
      }
      if (bandFilter === 'all') return true;
      const r = ratings[c.id];
      if (!r || r === 'error') return bandFilter === 'insufficient_data';
      return r.band === bandFilter;
    });
  }, [customers, ratings, bandFilter, search]);

  async function recompute(customerId: string): Promise<void> {
    await api.post(
      `/credit-rating/tenants/${encodeURIComponent(customerId)}/recompute`,
      {},
    );
    await loadRating(customerId);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-indigo-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {t('title')}
          </h2>
          <p className="text-sm text-gray-500">
            {t('subtitle')}
          </p>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="search"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-64"
        />
        <select
          value={bandFilter}
          onChange={(e) => setBandFilter(e.target.value as Band | 'all')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">{t('filters.allBands')}</option>
          <option value="excellent">{t('filters.excellent')}</option>
          <option value="good">{t('filters.good')}</option>
          <option value="fair">{t('filters.fair')}</option>
          <option value="poor">{t('filters.poor')}</option>
          <option value="very_poor">{t('filters.veryPoor')}</option>
          <option value="insufficient_data">{t('filters.insufficient')}</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">{t('table.tenant')}</th>
                <th className="text-left px-3 py-2">{t('table.score')}</th>
                <th className="text-left px-3 py-2">{t('table.band')}</th>
                <th className="text-left px-3 py-2">{t('table.weakestFactor')}</th>
                <th className="text-left px-3 py-2">{t('table.freshness')}</th>
                <th className="text-right px-3 py-2">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {visible.map((c) => {
                const r = ratings[c.id];
                const band: Band =
                  r === undefined || r === 'error'
                    ? 'insufficient_data'
                    : r.band;
                return (
                  <tr
                    key={c.id}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {c.name ?? c.email ?? c.id}
                    </td>
                    <td className="px-3 py-2">
                      {r && r !== 'error' && r.numericScore !== null
                        ? `${r.numericScore} (${r.letterGrade})`
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs ${BAND_COLORS[band]}`}
                      >
                        {BAND_LABEL[band]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {r && r !== 'error' ? (r.weakestFactor ?? '—') : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {r && r !== 'error' ? r.dataFreshness : '—'}
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => setDetailOpen(c.id)}
                        className="px-2 py-1 text-indigo-600 hover:underline text-xs"
                      >
                        <BarChart3 className="inline h-3 w-3 mr-1" />
                        {t('actions.details')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void recompute(c.id)}
                        className="px-2 py-1 text-gray-600 hover:underline text-xs"
                      >
                        <RefreshCw className="inline h-3 w-3 mr-1" />
                        {t('actions.recompute')}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-gray-500"
                  >
                    {t('empty.noMatches')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {detailOpen && ratings[detailOpen] && ratings[detailOpen] !== 'error' && (
        <DimensionDetail
          rating={ratings[detailOpen] as CreditRating}
          onClose={() => setDetailOpen(null)}
        />
      )}
    </div>
  );
}

function DimensionDetail({
  rating,
  onClose,
}: {
  readonly rating: CreditRating;
  readonly onClose: () => void;
}): JSX.Element {
  const t = useTranslations('tenantCredit');
  const dims = rating.dimensions;
  const rows: Array<[string, DimensionScore]> = [
    [t('dimensions.paymentHistory'), dims.payment_history],
    [t('dimensions.promiseKeeping'), dims.promise_keeping],
    [t('dimensions.rentToIncome'), dims.rent_to_income],
    [t('dimensions.tenancyLength'), dims.tenancy_length],
    [t('dimensions.disputeHistory'), dims.dispute_history],
  ];
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold">{t('detail.title')}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-gray-500 hover:underline"
        >
          {t('detail.close')}
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map(([label, dim]) => (
          <div key={label} className="flex items-center gap-3">
            <div className="w-32 text-sm text-gray-700">{label}</div>
            <div className="flex-1 h-2 bg-gray-100 rounded">
              <div
                className="h-2 bg-indigo-500 rounded"
                style={{ width: `${Math.round(dim.score * 100)}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 w-28 text-right">
              {(dim.score * 100).toFixed(0)}% · w{(dim.weight * 100).toFixed(0)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <h4 className="text-sm font-semibold">{t('detail.recommendations')}</h4>
        <ul className="list-disc ml-5 text-sm text-gray-700">
          {rating.recommendations.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
