/**
 * UsageAnalyticsPage — DAU / WAU / MAU breakdown per day.
 *
 * Assumed backend endpoints:
 *   GET /analytics/usage?days=<7|14|30|90>
 *       -> { data: { series: UsagePoint[], summary: UsageSummary } }
 *
 * The api client normalizes responses to { success, data }.
 */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Activity, RefreshCw } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';

interface UsagePoint {
  date: string;
  dau: number;
  wau: number;
  mau: number;
  newUsers: number;
}

interface UsageSummary {
  latestDau: number;
  latestWau: number;
  latestMau: number;
  stickiness: number;
}

interface UsageResponse {
  series: UsagePoint[];
  summary: UsageSummary;
}

export default function UsageAnalyticsPage() {
  const [series, setSeries] = useState<UsagePoint[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [days, setDays] = useState<7 | 14 | 30 | 90>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<UsageResponse>(`/analytics/usage?days=${days}`)
      .then((res) => {
        if (res.success && res.data) {
          setSeries(res.data.series);
          setSummary(res.data.summary);
        } else {
          setError(res.error ?? 'Failed to load usage analytics.');
          setSeries([]);
          setSummary(null);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usage Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Daily, weekly, and monthly active user counts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as 7 | 14 | 30 | 90)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            type="button"
            onClick={fetchUsage}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Refresh usage"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {summary && !loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <SummaryCard label="DAU (latest)" value={summary.latestDau.toLocaleString()} />
          <SummaryCard label="WAU (latest)" value={summary.latestWau.toLocaleString()} />
          <SummaryCard label="MAU (latest)" value={summary.latestMau.toLocaleString()} />
          <SummaryCard label="Stickiness (DAU/MAU)" value={`${(summary.stickiness * 100).toFixed(1)}%`} />
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
            onClick={fetchUsage}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : series.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl border border-gray-200">
          <Activity className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">No usage data in this window.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">DAU</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">WAU</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">MAU</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">New users</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {series.map((p) => (
                <tr key={p.date} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">{formatDate(p.date)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900 font-medium">{p.dau.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{p.wau.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{p.mau.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-green-600">+{p.newUsers.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}
