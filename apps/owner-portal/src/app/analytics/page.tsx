import React from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Home,
  DollarSign,
  TrendingUp,
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
import { Skeleton, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { formatPercentage } from '../../lib/api';
import { useAnalyticsSummary, useRevenueAnalytics, useExpensesAnalytics } from '../../lib/hooks';
import { useTenantCurrencyFormatter } from '../../hooks/useTenantCurrency';

export default function AnalyticsPage() {
  const t = useTranslations('analyticsPage');
  // Tenant-bound formatter — see `useTenantCurrency`.
  const { format: formatCurrency } = useTenantCurrencyFormatter();
  const { data: stats, isLoading, error, refetch } = useAnalyticsSummary();
  // Revenue time-series wired to the same real endpoint the detail
  // page uses (`/api/v1/analytics/revenue`). No fixture.
  const { data: revenueSeries = [] } = useRevenueAnalytics();
  // Expenses series for the side-by-side bar chart.
  const { data: expensesSeries = [] } = useExpensesAnalytics();

  const revenueData = revenueSeries.map((r) => ({
    month: r.month,
    revenue: r.rent + r.other,
  }));
  // Merge revenue + expenses by month for the bar chart.
  const expensesByMonth = new Map(
    expensesSeries.map((e) => [e.month, e.maintenance + e.utilities + e.admin]),
  );
  const revenueVsExpenses = revenueData.map((r) => ({
    month: r.month,
    revenue: r.revenue,
    expenses: expensesByMonth.get(r.month) ?? 0,
  }));

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <AlertDescription>
          {error instanceof Error ? error.message : 'Failed to load analytics'}
          <Button size="sm" onClick={() => refetch?.()} className="ml-2">{t('retry')}</Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/analytics/occupancy"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            <Home className="h-4 w-4" />
            {t('occupancy')}
          </Link>
          <Link
            to="/analytics/revenue"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            <DollarSign className="h-4 w-4" />
            {t('revenue')}
          </Link>
          <Link
            to="/analytics/expenses"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            <TrendingUp className="h-4 w-4" />
            {t('expenses')}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Home className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('occupancyRate')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatPercentage(stats?.occupancy ?? 0)}
          </p>
          <Link to="/analytics/occupancy" className="text-sm text-blue-600 hover:text-blue-700 mt-1 flex items-center gap-1">
            {t('viewTrends')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('monthlyRevenue')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(stats?.revenue ?? 0)}
          </p>
          <Link to="/analytics/revenue" className="text-sm text-blue-600 hover:text-blue-700 mt-1 flex items-center gap-1">
            {t('viewAnalysis')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-yellow-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('monthlyExpenses')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(stats?.expenses ?? 0)}
          </p>
          <Link to="/analytics/expenses" className="text-sm text-blue-600 hover:text-blue-700 mt-1 flex items-center gap-1">
            {t('viewBreakdown')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BarChart3 className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('netOperatingIncome')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(stats?.noi ?? 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('revenueTrend')}</h3>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('revenueVsExpenses')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueVsExpenses}>
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
                <Bar dataKey="expenses" name="Expenses" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
