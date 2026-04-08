import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Home,
  DollarSign,
  TrendingUp,
  PieChart,
  ArrowRight,
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

interface PortfolioSummary {
  occupancy: number;
  revenue: number;
  expenses: number;
  noi: number;
}

interface RevenueTrendPoint {
  month: string;
  rent: number;
  other: number;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<PortfolioSummary | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<PortfolioSummary>('/analytics/summary'),
      api.get<RevenueTrendPoint[]>('/analytics/revenue'),
    ])
      .then(([summaryRes, revenueRes]) => {
        if (cancelled) return;
        if (summaryRes.success && summaryRes.data) {
          setStats(summaryRes.data);
        } else {
          setStats(null);
          setError(summaryRes.error?.message ?? 'Portfolio KPIs are unavailable.');
        }
        if (revenueRes.success && revenueRes.data) {
          setRevenueTrend(revenueRes.data);
        } else {
          setRevenueTrend([]);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Portfolio KPIs are unavailable.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const revenueData = revenueTrend.map((point) => ({
    month: point.month,
    revenue: point.rent + point.other,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500">Property analytics and insights</p>
        </div>
        <div className="flex gap-3">
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
            <TrendingUp className="h-4 w-4" />
            Expenses
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Home className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Occupancy Rate</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {stats ? formatPercentage(stats.occupancy) : '—'}
          </p>
          <Link to="/analytics/occupancy" className="text-sm text-blue-600 hover:text-blue-700 mt-1 flex items-center gap-1">
            View trends <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total Revenue</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {stats ? formatCurrency(stats.revenue) : '—'}
          </p>
          <Link to="/analytics/revenue" className="text-sm text-blue-600 hover:text-blue-700 mt-1 flex items-center gap-1">
            View analysis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-yellow-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total Expenses</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {stats ? formatCurrency(stats.expenses) : '—'}
          </p>
          <Link to="/analytics/expenses" className="text-sm text-blue-600 hover:text-blue-700 mt-1 flex items-center gap-1">
            View breakdown <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BarChart3 className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Net Operating Income</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {stats ? formatCurrency(stats.noi) : '—'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue vs Expenses</h3>
          <div className="h-64">
            {stats && revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={revenueData.map((d) => ({
                    ...d,
                    expenses: revenueData.length > 0 ? stats.expenses / revenueData.length : 0,
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
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                  />
                  <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses (avg)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">
                No revenue or expense data available yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
