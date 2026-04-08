import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, DollarSign, TrendingUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api, formatCurrency } from '../../../lib/api';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];

interface RevenueMeta {
  trend: Array<{ month: string; rent: number; other: number }>;
  bySource: Array<{ name: string; value: number }>;
  totalRevenue: number;
}

export default function RevenuePage() {
  const [chartData, setChartData] = useState<
    Array<{ month: string; rent: number; other: number }>
  >([]);
  const [bySource, setBySource] = useState<Array<{ name: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<Array<{ month: string; rent: number; other: number }>>('/analytics/revenue')
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setChartData(res.data);
          const meta = (res as { meta?: RevenueMeta }).meta;
          if (meta) {
            setBySource(meta.bySource);
          }
        } else {
          setChartData([]);
          setBySource([]);
          setError(res.error?.message ?? 'Live revenue KPIs are unavailable.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Live revenue KPIs are unavailable.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/analytics" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Analysis</h1>
          <p className="text-gray-500">Breakdown of revenue sources and trends</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total Revenue</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {chartData.length > 0
              ? formatCurrency(
                  chartData.reduce((a, d) => a + d.rent + d.other, 0) / chartData.length
                )
              : '—'}
          </p>
          <p className="text-sm text-gray-500">avg monthly</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Rent Revenue</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {chartData.length > 0
              ? formatCurrency(chartData[chartData.length - 1]?.rent ?? 0)
              : '—'}
          </p>
          <p className="text-sm text-gray-500">latest period</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Other Income</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {chartData.length > 0
              ? formatCurrency(chartData[chartData.length - 1]?.other ?? 0)
              : '—'}
          </p>
          <p className="text-sm text-gray-500">latest period</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Month</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
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
                <Bar dataKey="rent" name="Rent" fill="#3B82F6" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="other" name="Other" fill="#10B981" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Source</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={bySource}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {bySource.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
