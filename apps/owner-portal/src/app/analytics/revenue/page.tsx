import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, DollarSign, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api, formatCurrency } from '../../../lib/api';

/**
 * Revenue analytics subpage. Wired to `/api/v1/analytics/revenue`.
 * Removes the local mock dataset that used to render when the API returned
 * nothing — empty data now shows an explicit empty state, errors show retry.
 */

type Point = { month: string; rent: number; other: number };

export default function RevenuePage() {
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const response = await api.get<Point[]>('/analytics/revenue');
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load revenue data');
      }
      setData(response.data ?? []);
    } catch (err) {
      setData([]);
      setError(err instanceof Error ? err.message : 'Failed to load revenue data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const latest = data[data.length - 1];
  const totalThisMonth = latest ? latest.rent + latest.other : 0;
  const avgMonthly = data.length
    ? data.reduce((sum, point) => sum + point.rent + point.other, 0) / data.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/analytics" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Revenue Analysis</h1>
          <p className="text-gray-500">Breakdown of revenue sources and trends</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="animate-pulse h-28 bg-gray-200 rounded-xl" />
          <div className="animate-pulse h-28 bg-gray-200 rounded-xl" />
          <div className="animate-pulse h-28 bg-gray-200 rounded-xl" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button
            onClick={handleRefresh}
            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Avg Monthly</span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-gray-900">
                {formatCurrency(avgMonthly)}
              </p>
              <p className="text-sm text-gray-500">{data.length} months</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Rent Revenue</span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-gray-900">
                {formatCurrency(latest?.rent ?? 0)}
              </p>
              <p className="text-sm text-gray-500">this month</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Other Income</span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-gray-900">
                {formatCurrency(latest?.other ?? 0)}
              </p>
              <p className="text-sm text-gray-500">this month</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Month</h3>
            <div className="h-80">
              {data.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500 border border-dashed rounded-lg">
                  No payments recorded for the trailing 7 months.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
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
                    <Bar
                      dataKey="rent"
                      name="Rent"
                      fill="#3B82F6"
                      radius={[4, 4, 0, 0]}
                      stackId="a"
                    />
                    <Bar
                      dataKey="other"
                      name="Other"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                      stackId="a"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
