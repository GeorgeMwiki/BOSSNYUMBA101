/**
 * PlatformBillingPage — tenant billing overview.
 *
 * Assumed backend endpoints:
 *   GET  /platform/billing?status=<any|active|past_due|canceled|trialing>&search=<q>
 *        -> { data: { items: TenantBilling[], totals: BillingTotals } }
 *   POST /platform/billing/:tenantId/retry
 *
 * The api client normalizes responses to { success, data }.
 */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CreditCard,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api, formatCurrency, formatDate } from '../../../lib/api';

type BillingStatus = 'active' | 'past_due' | 'canceled' | 'trialing';

interface TenantBilling {
  tenantId: string;
  tenantName: string;
  plan: string;
  status: BillingStatus;
  mrrUsd: number;
  outstandingUsd: number;
  nextInvoiceAt: string | null;
  lastPaymentAt: string | null;
}

interface BillingTotals {
  mrrUsd: number;
  outstandingUsd: number;
  activeTenants: number;
  pastDueTenants: number;
}

interface PlatformBillingResponse {
  items: TenantBilling[];
  totals: BillingTotals;
}

const statusBadge: Record<BillingStatus, string> = {
  active: 'bg-green-100 text-green-700',
  trialing: 'bg-blue-100 text-blue-700',
  past_due: 'bg-red-100 text-red-700',
  canceled: 'bg-gray-100 text-gray-700',
};

export default function PlatformBillingPage() {
  const [items, setItems] = useState<TenantBilling[]>([]);
  const [totals, setTotals] = useState<BillingTotals | null>(null);
  const [statusFilter, setStatusFilter] = useState<'any' | BillingStatus>('any');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchBilling = useCallback(() => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ status: statusFilter });
    if (search) qs.set('search', search);
    api
      .get<PlatformBillingResponse>(`/platform/billing?${qs.toString()}`)
      .then((res) => {
        if (res.success && res.data) {
          setItems(res.data.items);
          setTotals(res.data.totals);
        } else {
          setError(res.error ?? 'Failed to load billing data.');
          setItems([]);
          setTotals(null);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter, search]);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const handleRetry = async (t: TenantBilling) => {
    setRetryingId(t.tenantId);
    const res = await api.post(`/platform/billing/${t.tenantId}/retry`, {});
    setRetryingId(null);
    if (res.success) {
      fetchBilling();
    } else {
      setError(res.error ?? 'Failed to retry payment.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing &amp; Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tenant-level billing status, MRR, and outstanding balances.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchBilling}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          aria-label="Refresh billing"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {totals && !loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <SummaryCard label="Total MRR" value={formatCurrency(totals.mrrUsd, 'USD')} />
          <SummaryCard
            label="Outstanding"
            value={formatCurrency(totals.outstandingUsd, 'USD')}
            tone={totals.outstandingUsd > 0 ? 'warning' : 'neutral'}
          />
          <SummaryCard label="Active tenants" value={totals.activeTenants.toLocaleString()} />
          <SummaryCard
            label="Past-due tenants"
            value={totals.pastDueTenants.toLocaleString()}
            tone={totals.pastDueTenants > 0 ? 'danger' : 'neutral'}
          />
        </div>
      )}

      <form
        onSubmit={handleSearch}
        className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search tenant name or plan"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'any' | BillingStatus)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="any">Any status</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="past_due">Past due</option>
          <option value="canceled">Canceled</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Search
        </button>
      </form>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white rounded-xl border border-gray-200">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <p className="text-gray-600">{error}</p>
          <button
            type="button"
            onClick={fetchBilling}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl border border-gray-200">
          <CreditCard className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">No tenants match the current filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">MRR</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Outstanding</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Next invoice</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last payment</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((t) => (
                <tr key={t.tenantId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.tenantName}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">{t.plan}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${statusBadge[t.status]}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">
                    {formatCurrency(t.mrrUsd, 'USD')}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <span className={t.outstandingUsd > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                      {formatCurrency(t.outstandingUsd, 'USD')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {t.nextInvoiceAt ? formatDate(t.nextInvoiceAt) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {t.lastPaymentAt ? formatDate(t.lastPaymentAt) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRetry(t)}
                      disabled={retryingId === t.tenantId || t.status !== 'past_due'}
                      className="inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700 disabled:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 rounded px-2 py-1"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {retryingId === t.tenantId ? 'Retrying...' : 'Retry charge'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'danger' ? 'text-red-600' : tone === 'warning' ? 'text-amber-600' : 'text-gray-900';
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
