import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Target, AlertCircle, BarChart3 } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api, formatCurrency, formatPercentage } from '../../../lib/api';

interface GrowthData {
  month: string;
  revenue: number;
  value: number;
  occupancy: number;
}

export default function PortfolioGrowthPage() {
  const [data, setData] = useState<GrowthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<GrowthData[]>('/portfolio/growth').then((res) => {
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || 'Failed to load growth data.');
      }
      setLoading(false);
    }).catch(() => {
      setError('An unexpected error occurred while loading growth data.');
      setLoading(false);
    });
  }, []);

  const chartData = data;

  const revenueGrowth = chartData.length >= 2
    ? ((chartData[chartData.length - 1].revenue - chartData[0].revenue) / chartData[0].revenue) * 100
    : null;

  const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].value : null;
  const latestOccupancy = chartData.length > 0 ? chartData[chartData.length - 1].occupancy : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <p className="text-gray-700 font-medium mb-2">Unable to load growth data</p>
        <p className="text-sm text-gray-500 mb-4">{error}</p>
        <Link to="/portfolio" className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Portfolio
        </Link>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <BarChart3 className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-700 font-medium mb-2">No growth data available yet</p>
        <p className="text-sm text-gray-500 mb-4">Growth data will appear here once portfolio performance has been recorded.</p>
        <Link to="/portfolio" className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Portfolio
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/portfolio"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio Growth</h1>
          <p className="text-gray-500">Track your portfolio performance over time</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Revenue Growth</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {revenueGrowth !== null ? `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(1)}%` : '-'}
          </p>
          <p className="text-sm text-gray-500">vs last 6 months</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Portfolio Value</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {latestValue !== null ? formatCurrency(latestValue) : '-'}
          </p>
          <p className="text-sm text-gray-500">current estimate</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Occupancy Trend</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {latestOccupancy !== null ? formatPercentage(latestOccupancy) : '-'}
          </p>
          <p className="text-sm text-gray-500">current rate</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
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
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3B82F6"
                fill="#DBEAFE"
                strokeWidth={2}
                name="Revenue"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Value Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#10B981"
                fill="#D1FAE5"
                strokeWidth={2}
                name="Portfolio Value"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
