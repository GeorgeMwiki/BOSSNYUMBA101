/**
 * GrowthAnalyticsPage — signups, churn, and net growth by period.
 *
 * Assumed backend endpoints:
 *   GET /analytics/growth?granularity=<day|week|month>&periods=<n>
 *       -> { data: { series: GrowthPoint[], summary: GrowthSummary } }
 *
 * The api client normalizes responses to { success, data }.
 */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';

type Granularity = 'day' | 'week' | 'month';

interface GrowthPoint {
  periodStart: string;
  signups: number;
  churned: number;
  net: number;
  mrrUsd: number;
}

interface GrowthSummary {
  totalSignups: number;
  totalChurned: number;
  netGrowth: number;
  mrrGrowthPct: number;
}

interface GrowthResponse {
  series: GrowthPoint[];
  summary: GrowthSummary;
}

export default function GrowthAnalyticsPage() {
  const [series, setSeries] = useState<GrowthPoint[]>([]);
  const [summary, setSummary] = useState<GrowthSummary | null>(null);
  const [granularity, setGranularity] = useState<Granularity>('week');
  const [periods, setPeriods] = useState<number>(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrowth = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<GrowthResponse>(`/analytics/growth?granularity=${granularity}&periods=${periods}`)
      .then((res) => {
        if (res.success && res.data) {
          setSeries(res.data.series);
          setSummary(res.data.summary);
        } else {
          setError(res.error ?? 'Failed to load growth analytics.');
          setSeries([]);
          setSummary(null);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [granularity, periods]);

  useEffect(() => {
    fetchGrowth();
  }, [fetchGrowth]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Growth Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Signups, churn, and net growth across time periods.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as Granularity)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
          <select
            value={periods}
            onChange={(e) => setPeriods(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value={6}>Last 6</option>
            <option value={12}>Last 12</option>
            <option value={24}>Last 24</option>
            <option value={52}>Last 52</option>
          </select>
          <button
            type="button"
            onClick={fetchGrowth}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Refresh growth"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {summary && !loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <SummaryCard label="Signups" value={summary.totalSignups.toLocaleString()} tone="positive" />
          <SummaryCard label="Churned" value={summary.totalChurned.toLocaleString()} tone="negative" />
          <SummaryCard
            label="Net growth"
            value={summary.netGrowth.toLocaleString()}
            tone={summary.netGrowth >= 0 ? 'positive' : 'negative'}
          />
          <SummaryCard
            label="MRR change"
            value={`${summary.mrrGrowthPct >= 0 ? '+' : ''}${summary.mrrGrowthPct.toFixed(1)}%`}
            tone={summary.mrrGrowthPct >= 0 ? 'positive' : 'negative'}
          />
        </div>
      )}

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
            onClick={fetchGrowth}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : series.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl border border-gray-200">
          <TrendingUp className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">No growth data for this window.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Period starting</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Signups</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Churned</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Net</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">MRR (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {series.map((p) => (
                <tr key={p.periodStart} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">{formatDate(p.periodStart)}</td>
                  <td className="px-4 py-3 text-right text-sm text-green-600">+{p.signups.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-red-600">-{p.churned.toLocaleString()}</td>
                  <td
                    className={`px-4 py-3 text-right text-sm font-medium ${
                      p.net >= 0 ? 'text-gray-900' : 'text-red-700'
                    }`}
                  >
                    {p.net >= 0 ? '+' : ''}
                    {p.net.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">${p.mrrUsd.toLocaleString()}</td>
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
  tone,
}: {
  label: string;
  value: string;
  tone: 'positive' | 'negative' | 'neutral';
}) {
  const toneClass =
    tone === 'positive' ? 'text-green-600' : tone === 'negative' ? 'text-red-600' : 'text-gray-900';
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
