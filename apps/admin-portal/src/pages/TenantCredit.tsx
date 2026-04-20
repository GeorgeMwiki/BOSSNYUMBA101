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

const BAND_LABEL: Record<Band, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  very_poor: 'Very poor',
  insufficient_data: 'Not enough data',
};

export default function TenantCredit(): JSX.Element {
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
    else setError(res.error ?? 'Unable to load tenants.');
    setLoading(false);
  }, []);

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
            Tenant credit ratings
          </h2>
          <p className="text-sm text-gray-500">
            FICO-scale 300-850 rating from real payment data. Click a row for
            the full dimension breakdown.
          </p>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="search"
          placeholder="Search tenant…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-64"
        />
        <select
          value={bandFilter}
          onChange={(e) => setBandFilter(e.target.value as Band | 'all')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All bands</option>
          <option value="excellent">Excellent (750+)</option>
          <option value="good">Good (660-749)</option>
          <option value="fair">Fair (550-659)</option>
          <option value="poor">Poor (450-549)</option>
          <option value="very_poor">Very poor (&lt;450)</option>
          <option value="insufficient_data">Insufficient data</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading tenants…
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Tenant</th>
                <th className="text-left px-3 py-2">Score</th>
                <th className="text-left px-3 py-2">Band</th>
                <th className="text-left px-3 py-2">Weakest factor</th>
                <th className="text-left px-3 py-2">Freshness</th>
                <th className="text-right px-3 py-2">Actions</th>
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
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => void recompute(c.id)}
                        className="px-2 py-1 text-gray-600 hover:underline text-xs"
                      >
                        <RefreshCw className="inline h-3 w-3 mr-1" />
                        Recompute
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
                    No tenants match these filters.
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
  const dims = rating.dimensions;
  const rows: Array<[string, DimensionScore]> = [
    ['Payment history', dims.payment_history],
    ['Promise keeping', dims.promise_keeping],
    ['Rent-to-income', dims.rent_to_income],
    ['Tenancy length', dims.tenancy_length],
    ['Dispute history', dims.dispute_history],
  ];
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold">Dimension breakdown</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-gray-500 hover:underline"
        >
          Close
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
        <h4 className="text-sm font-semibold">Recommendations</h4>
        <ul className="list-disc ml-5 text-sm text-gray-700">
          {rating.recommendations.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
