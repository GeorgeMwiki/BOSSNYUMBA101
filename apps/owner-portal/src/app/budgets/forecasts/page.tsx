import React from 'react';
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
import { Skeleton, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { useBudgetForecasts } from '../../../lib/hooks';
import { useTenantCurrencyFormatter } from '../../../hooks/useTenantCurrency';

export default function BudgetForecastsPage() {
  const t = useTranslations('budgetForecastsPage');
  // Tenant-bound formatter — see `useTenantCurrency`.
  const { format: formatCurrency } = useTenantCurrencyFormatter();
  const { data = [], isLoading, error, refetch } = useBudgetForecasts();

  // No fixture fallback — when the backend has no history yet, we render
  // an explicit empty state. The shape comes from the real Holt-Winters
  // route at `/api/v1/budgets/forecasts` (see budget-forecast.router.ts).
  const forecastData = data;

  const totalProjectedRevenue = forecastData.reduce((a, d) => a + d.projectedRevenue, 0);
  const totalProjectedExpenses = forecastData.reduce((a, d) => a + d.projectedExpenses, 0);
  const totalProjectedNoi = forecastData.reduce((a, d) => a + d.projectedNoi, 0);

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <AlertDescription>
          {error instanceof Error ? error.message : 'Failed to load forecasts'}
          <Button size="sm" onClick={() => refetch?.()} className="ml-2">{t('retry')}</Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Honest empty state — the backend returns [] when there isn't enough
  // history (< 6 months of completed payments) to fit Holt-Winters.
  if (forecastData.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/budgets" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-gray-500">{t('subtitle')}</p>
          </div>
        </div>
        <Alert>
          <AlertDescription>
            Not enough completed-payment history yet for a forecast. The
            Holt-Winters projection needs at least six months of revenue
            data. Once it's available, this page will render real
            projections with 95% confidence intervals.
          </AlertDescription>
        </Alert>
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
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('projectedRevenue')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(totalProjectedRevenue)}
          </p>
          <p className="text-sm text-gray-500">{t('next8Months')}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <TrendingDown className="h-5 w-5 text-yellow-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('projectedExpenses')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(totalProjectedExpenses)}
          </p>
          <p className="text-sm text-gray-500">{t('next8Months')}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('projectedNoi')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(totalProjectedNoi)}
          </p>
          <p className="text-sm text-gray-500">{t('next8Months')}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('revenueVsExpensesForecast')}</h3>
        <p className="text-xs text-gray-500 mb-2">
          Holt-Winters projection · 95% confidence interval shaded
        </p>
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
              {/* Revenue 95% band (rendered as a transparent area whose
                  lower = projectedRevenueLower and upper - lower is its
                  height; we cheat by rendering the upper area first then
                  the lower mask). Recharts has no native band primitive,
                  so we approximate with two stacked Areas: lower as a
                  baseline, upper as the top edge. */}
              <Area
                type="monotone"
                dataKey="projectedRevenueUpper"
                stroke="transparent"
                fill="#D1FAE5"
                fillOpacity={0.4}
                name="Revenue · upper 95%"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="projectedRevenueLower"
                stroke="transparent"
                fill="white"
                fillOpacity={1}
                name="Revenue · lower 95%"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="projectedRevenue"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.2}
                strokeWidth={2}
                name="Projected Revenue"
              />
              <Area
                type="monotone"
                dataKey="projectedExpenses"
                stroke="#F59E0B"
                fill="#F59E0B"
                fillOpacity={0.15}
                strokeWidth={2}
                name="Projected Expenses"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('netOperatingIncomeForecast')}</h3>
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
