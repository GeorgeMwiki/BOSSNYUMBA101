import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Target } from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api, formatCurrency } from '../../../lib/api';

interface ForecastData {
  month: string;
  projectedRevenue: number;
  projectedExpenses: number;
  projectedNoi: number;
}

export default function BudgetForecastsPage() {
  const [data, setData] = useState<ForecastData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ForecastData[]>('/budgets/forecasts').then((res) => {
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    });
  }, []);

  const forecastData = data.length
    ? data
    : [
        { month: 'Mar', projectedRevenue: 9600000, projectedExpenses: 2200000, projectedNoi: 7400000 },
        { month: 'Apr', projectedRevenue: 9800000, projectedExpenses: 2200000, projectedNoi: 7600000 },
        { month: 'May', projectedRevenue: 9800000, projectedExpenses: 2300000, projectedNoi: 7500000 },
        { month: 'Jun', projectedRevenue: 9900000, projectedExpenses: 2300000, projectedNoi: 7600000 },
        { month: 'Jul', projectedRevenue: 10000000, projectedExpenses: 2350000, projectedNoi: 7650000 },
        { month: 'Aug', projectedRevenue: 10100000, projectedExpenses: 2350000, projectedNoi: 7750000 },
        { month: 'Sep', projectedRevenue: 10200000, projectedExpenses: 2400000, projectedNoi: 7800000 },
        { month: 'Oct', projectedRevenue: 10300000, projectedExpenses: 2400000, projectedNoi: 7900000 },
      ];

  const totalProjectedRevenue = forecastData.reduce((a, d) => a + d.projectedRevenue, 0);
  const totalProjectedExpenses = forecastData.reduce((a, d) => a + d.projectedExpenses, 0);
  const totalProjectedNoi = forecastData.reduce((a, d) => a + d.projectedNoi, 0);

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
        <Link to="/budgets" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Forecasts</h1>
          <p className="text-gray-500">Projected revenue, expenses, and NOI</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Projected Revenue</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(totalProjectedRevenue)}
          </p>
          <p className="text-sm text-gray-500">next 8 months</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <TrendingDown className="h-5 w-5 text-yellow-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Projected Expenses</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(totalProjectedExpenses)}
          </p>
          <p className="text-sm text-gray-500">next 8 months</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Projected NOI</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(totalProjectedNoi)}
          </p>
          <p className="text-sm text-gray-500">next 8 months</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue vs Expenses Forecast</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecastData}>
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
                dataKey="projectedRevenue"
                stroke="#10B981"
                fill="#D1FAE5"
                strokeWidth={2}
                name="Projected Revenue"
              />
              <Area
                type="monotone"
                dataKey="projectedExpenses"
                stroke="#F59E0B"
                fill="#FEF3C7"
                strokeWidth={2}
                name="Projected Expenses"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Net Operating Income Forecast</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecastData}>
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
              <Line
                type="monotone"
                dataKey="projectedNoi"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ fill: '#3B82F6' }}
                name="Projected NOI"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
