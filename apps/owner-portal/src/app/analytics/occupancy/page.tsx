import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Home, AlertCircle, RefreshCw } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api, formatPercentage } from '../../../lib/api';

/**
 * Occupancy analytics subpage.
 *
 * Fetches `/api/v1/analytics/occupancy` for the trend line and derives the
 * current snapshot from `/analytics/summary`. Mock fallback data has been
 * removed — when live data is unavailable we show the error+retry state.
 */

type TrendPoint = { month: string; rate: number };
interface Summary {
  occupancy: { value: number; previous: number; delta: number | null };
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

interface OccupancyMeta {
  rate: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
}

interface Property {
  id: string;
  name: string;
}

export default function OccupancyPage() {
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [trendRes, summaryRes] = await Promise.all([
        api.get<TrendPoint[]>('/analytics/occupancy'),
        api.get<Summary>('/analytics/summary'),
      ]);
      if (!trendRes.success) {
        throw new Error(trendRes.error?.message || 'Failed to load occupancy trend');
      }
      setTrend(trendRes.data ?? []);
      setSummary(summaryRes.success && summaryRes.data ? summaryRes.data : null);
    } catch (err) {
      setTrend([]);
      setSummary(null);
      setError(err instanceof Error ? err.message : 'Failed to load occupancy data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/analytics" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Occupancy Trends</h1>
          <p className="text-gray-500">Track occupancy rates across your portfolio</p>
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
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
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
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Home className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Current Rate</span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-gray-900">
                {formatPercentage(summary?.occupancy.value ?? trend[trend.length - 1]?.rate ?? 0)}
              </p>
              {summary?.occupancy.delta !== null && summary?.occupancy.delta !== undefined && (
                <p className="text-sm text-gray-500">
                  {summary.occupancy.delta >= 0 ? '+' : ''}
                  {summary.occupancy.delta.toFixed(1)}pts vs last month
                </p>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <span className="text-sm font-medium text-gray-500">Highest Month</span>
              <p className="mt-3 text-2xl font-semibold text-gray-900">
                {formatPercentage(
                  trend.length ? Math.max(...trend.map((point) => point.rate)) : 0,
                )}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <span className="text-sm font-medium text-gray-500">Lowest Month</span>
              <p className="mt-3 text-2xl font-semibold text-gray-900">
                {formatPercentage(
                  trend.length ? Math.min(...trend.map((point) => point.rate)) : 0,
                )}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Occupancy Trend</h3>
            <div className="h-80">
              {trend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500 border border-dashed rounded-lg">
                  No occupancy history yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                    <YAxis
                      stroke="#9CA3AF"
                      fontSize={12}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, 'Occupancy']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
