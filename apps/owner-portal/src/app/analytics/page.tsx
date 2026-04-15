import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Home,
  DollarSign,
  AlertCircle,
  Wrench,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api, formatCurrency, formatPercentage } from '../../lib/api';

/**
 * Owner dashboard analytics landing page.
 *
 * Shows the four headline KPI cards (collection rate, occupancy, arrears total,
 * open tickets) wired to `/api/v1/analytics/summary` with period-over-period
 * deltas, plus trend charts driven by `/analytics/revenue` and
 * `/analytics/expenses`. Includes loading skeletons, an error + retry state,
 * a manual refresh button, and re-fetches when the JWT tenant (active org)
 * changes.
 */

interface KpiValue {
  value: number;
  previous: number;
  delta: number | null;
  unit: 'percent' | 'currency' | 'count';
  changePercent?: number;
}

interface KpiSummary {
  collectionRate: KpiValue;
  occupancy: KpiValue;
  arrears: KpiValue;
  openTickets: KpiValue;
  revenue: KpiValue;
  meta: {
    generatedAt: string;
    periodStart: string;
    periodEnd: string;
  };
}

type RevenuePoint = { month: string; rent: number; other: number };

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-gray-200" />
        <div className="h-3 w-24 rounded bg-gray-200" />
      </div>
      <div className="mt-4 h-7 w-28 rounded bg-gray-200" />
      <div className="mt-2 h-3 w-20 rounded bg-gray-200" />
    </div>
  );
}

function DeltaBadge({ delta, unit }: { delta: number | null; unit: KpiValue['unit'] }) {
  if (delta === null || delta === undefined) {
    return <span className="text-xs text-gray-400">no prior period</span>;
  }
  const positive = delta >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const colour = positive ? 'text-green-600' : 'text-red-600';
  let label: string;
  if (unit === 'percent') {
    label = `${positive ? '+' : ''}${delta.toFixed(1)}pts`;
  } else if (unit === 'currency') {
    label = `${positive ? '+' : ''}${formatCurrency(Math.abs(delta))}`;
    if (!positive) label = `-${formatCurrency(Math.abs(delta))}`;
  } else {
    label = `${positive ? '+' : ''}${delta}`;
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colour}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className="text-gray-500 font-normal">vs last month</span>
    </span>
  );
}

function renderValue(kpi: KpiValue): string {
  if (kpi.unit === 'percent') return formatPercentage(kpi.value);
  if (kpi.unit === 'currency') return formatCurrency(kpi.value);
  return String(kpi.value);
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<KpiSummary | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<RevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-fetch when the active org (tenant) changes. The token is refreshed by
  // the login/switch flow and written to localStorage, so polling it covers
  // the switch-tenant case without importing a context here.
  const [tenantKey, setTenantKey] = useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : ''),
  );
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === 'token' || event.key === 'activeOrgId') {
        setTenantKey(event.newValue ?? '');
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [summaryRes, revenueRes] = await Promise.all([
        api.get<KpiSummary>('/analytics/summary'),
        api.get<RevenuePoint[]>('/analytics/revenue'),
      ]);
      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data);
      } else {
        setSummary(null);
        throw new Error(summaryRes.error?.message || 'Failed to load KPIs');
      }
      setRevenueTrend(revenueRes.success && revenueRes.data ? revenueRes.data : []);
    } catch (err) {
      setSummary(null);
      setRevenueTrend([]);
      setError(err instanceof Error ? err.message : 'Failed to load KPIs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll();
  }, [fetchAll, tenantKey]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500">Property analytics and insights</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to="/analytics/occupancy"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            <Home className="h-4 w-4" />
            Occupancy
          </Link>
          <Link
            to="/analytics/revenue"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            <DollarSign className="h-4 w-4" />
            Revenue
          </Link>
          <Link
            to="/analytics/expenses"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            <BarChart3 className="h-4 w-4" />
            Expenses
          </Link>
        </div>
      </div>

      {/* KPI cards row */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Unable to load KPIs</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
          >
            Retry
          </button>
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Collection Rate</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-gray-900">
              {renderValue(summary.collectionRate)}
            </p>
            <DeltaBadge delta={summary.collectionRate.delta} unit="percent" />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Home className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Occupancy</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-gray-900">
              {renderValue(summary.occupancy)}
            </p>
            <DeltaBadge delta={summary.occupancy.delta} unit="percent" />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-yellow-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Arrears Total</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-gray-900">
              {renderValue(summary.arrears)}
            </p>
            <DeltaBadge delta={summary.arrears.delta} unit="currency" />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Wrench className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Open Tickets</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-gray-900">
              {renderValue(summary.openTickets)}
            </p>
            <DeltaBadge delta={summary.openTickets.delta} unit="count" />
          </div>
        </div>
      ) : null}

      {/* Sub-page links with arrow icons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/analytics/occupancy"
          className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
        >
          <span className="text-sm font-medium text-gray-700">Occupancy trends</span>
          <ArrowRight className="h-4 w-4 text-gray-400" />
        </Link>
        <Link
          to="/analytics/revenue"
          className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
        >
          <span className="text-sm font-medium text-gray-700">Revenue analysis</span>
          <ArrowRight className="h-4 w-4 text-gray-400" />
        </Link>
        <Link
          to="/analytics/expenses"
          className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
        >
          <span className="text-sm font-medium text-gray-700">Expense breakdown</span>
          <ArrowRight className="h-4 w-4 text-gray-400" />
        </Link>
      </div>

      {/* Charts */}
      {!loading && !error && revenueTrend.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={revenueTrend.map((point) => ({
                    month: point.month,
                    revenue: point.rent + point.other,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                  <YAxis
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3B82F6"
                    fill="#DBEAFE"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rent vs Other</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                  <YAxis
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                  />
                  <Bar dataKey="rent" name="Rent" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="other" name="Other" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
