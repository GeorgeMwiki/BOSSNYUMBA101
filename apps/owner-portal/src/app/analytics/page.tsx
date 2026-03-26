import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Home,
  DollarSign,
  TrendingUp,
  PieChart,
  ArrowRight,
  AlertTriangle,
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

export default function AnalyticsPage() {
  const [stats, setStats] = useState<{
    occupancy: number;
    revenue: number;
    expenses: number;
    noi: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = () => {
    setLoading(true);
    setError(null);
    api.get('/analytics/summary').then((res) => {
      if (res.success && res.data) {
        setStats(res.data as typeof stats);
      } else {
        setError('Unable to load analytics data.');
      }
      setLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Unable to load analytics data.');
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const [revenueData, setRevenueData] = useState<Array<{ month: string; revenue: number; expenses?: number }>>([]);

  useEffect(() => {
    if (stats) {
      api.get<Array<{ month: string; revenue: number; expenses?: number }>>('/analytics/revenue-trend').then((res) => {
        if (res.success && res.data) {
          setRevenueData(res.data);
        }
      });
    }
  }, [stats]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 bg-gray-200 rounded w-44" />
            <div className="h-4 bg-gray-200 rounded w-52" />
          </div>
          <div className="flex gap-3">
            {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-200 rounded-lg w-28" />)}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gray-200 rounded-lg" />
                <div className="h-4 bg-gray-200 rounded w-28" />
              </div>
              <div className="h-7 bg-gray-200 rounded w-28" />
              <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1,2].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
              <div className="h-5 bg-gray-200 rounded w-32" />
              <div className="h-64 bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <div className="p-4 bg-amber-50 rounded-full mb-4">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Analytics Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">{error}</p>
        <button
          onClick={() => fetchAnalytics()}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Home className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Occupancy Rate</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {stats?.occupancy ? formatPercentage(stats.occupancy) : '-'}
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
            <span className="text-sm font-medium text-gray-500">Monthly Revenue</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {stats?.revenue ? formatCurrency(stats.revenue) : '-'}
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
            <span className="text-sm font-medium text-gray-500">Monthly Expenses</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {stats?.expenses ? formatCurrency(stats.expenses) : '-'}
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
            {stats?.noi ? formatCurrency(stats.noi) : '-'}
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
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
                {revenueData.some((d) => d.expenses != null) && (
                  <Bar dataKey="expenses" name="Expenses" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
