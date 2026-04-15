/**
 * AnalyticsPage — platform-wide analytics overview.
 *
 * Assumed backend endpoints (served by the analytics service via the
 * platform admin gateway):
 *   GET /analytics/overview?window=<1d|7d|30d|90d>
 *       -> { data: { kpis: Kpi[], topTenants: TenantMetric[] } }
 *
 * The api client normalizes responses to { success, data }.
 */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, RefreshCw } from 'lucide-react';
import { api, formatCurrency } from '../../lib/api';

type TimeWindow = '1d' | '7d' | '30d' | '90d';

interface Kpi {
  key: string;
  label: string;
  value: number;
  unit: 'count' | 'percentage' | 'currency' | 'duration_ms';
  changePct: number;
}

interface TenantMetric {
  tenantId: string;
  tenantName: string;
  activeUsers: number;
  events: number;
  revenueUsd: number;
}

interface AnalyticsOverviewResponse {
  kpis: Kpi[];
  topTenants: TenantMetric[];
}

function formatKpi(kpi: Kpi): string {
  switch (kpi.unit) {
    case 'percentage':
      return `${kpi.value.toFixed(1)}%`;
    case 'currency':
      return formatCurrency(kpi.value, 'USD');
    case 'duration_ms':
      return `${kpi.value.toLocaleString()} ms`;
    default:
      return kpi.value.toLocaleString();
  }
}

export default function AnalyticsPage() {
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [topTenants, setTopTenants] = useState<TenantMetric[]>([]);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<AnalyticsOverviewResponse>(`/analytics/overview?window=${timeWindow}`)
      .then((res) => {
        if (res.success && res.data) {
          setKpis(res.data.kpis);
          setTopTenants(res.data.topTenants);
        } else {
          setError(res.error ?? 'Failed to load analytics.');
          setKpis([]);
          setTopTenants([]);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [timeWindow]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Overview</h1>
          <p className="text-sm text-gray-500 mt-1">
            Platform KPIs and top tenant activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value as TimeWindow)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
            type="button"
            onClick={fetchOverview}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Refresh analytics"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

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
            onClick={fetchOverview}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : kpis.length === 0 && topTenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl border border-gray-200">
          <BarChart3 className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">No analytics data for this window.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi) => (
              <div key={kpi.key} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xs uppercase tracking-wider text-gray-500">{kpi.label}</div>
                <div className="mt-1 text-xl font-semibold text-gray-900">{formatKpi(kpi)}</div>
                <div
                  className={`mt-1 text-xs font-medium ${
                    kpi.changePct >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {kpi.changePct >= 0 ? '+' : ''}
                  {kpi.changePct.toFixed(1)}% vs previous period
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Top tenants by activity</h2>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tenant</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Active users</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Events</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topTenants.map((t) => (
                  <tr key={t.tenantId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{t.tenantName}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">{t.activeUsers.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">{t.events.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(t.revenueUsd, 'USD')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
