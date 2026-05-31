import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Target } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Skeleton, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { formatPercentage } from '../../../lib/api';
import { usePortfolioGrowth } from '../../../lib/hooks';
import { useTenantCurrencyFormatter } from '../../../hooks/useTenantCurrency';

export default function PortfolioGrowthPage() {
  const t = useTranslations('portfolioGrowthPage');
  // Tenant-bound formatter — see `useTenantCurrency`.
  const { format: formatCurrency } = useTenantCurrencyFormatter();
  const { data = [], isLoading, error, refetch } = usePortfolioGrowth();

  // No fixture fallback — backend (`/api/v1/portfolio/growth`) now
  // returns real 12-month Drizzle aggregates of payments + active
  // leases per month-end (portfolio value = Σ active rent × 12).
  const chartData = data;

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
          {error instanceof Error ? error.message : 'Failed to load portfolio growth'}
          <Button size="sm" onClick={() => refetch?.()} className="ml-2">{t('retry')}</Button>
        </AlertDescription>
      </Alert>
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
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
      </div>

      {(() => {
        // Compute KPI tiles from real data only — no fallbacks.
        const recentSix = chartData.slice(-6);
        const earlierSix = chartData.slice(-12, -6);
        const recentSum = recentSix.reduce((a, d) => a + d.revenue, 0);
        const earlierSum = earlierSix.reduce((a, d) => a + d.revenue, 0);
        const growthPct =
          earlierSum === 0
            ? null
            : Math.round(((recentSum - earlierSum) / earlierSum) * 1000) / 10;
        const latest = chartData[chartData.length - 1];
        const portfolioValue = latest?.value ?? 0;
        const occupancyRate = latest?.occupancy ?? 0;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">{t('revenueGrowth')}</span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-gray-900">
                {growthPct == null ? '—' : `${growthPct > 0 ? '+' : ''}${growthPct}%`}
              </p>
              <p className="text-sm text-gray-500">{t('vsLast6Months')}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">{t('portfolioValue')}</span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-gray-900">
                {formatCurrency(portfolioValue)}
              </p>
              <p className="text-sm text-gray-500">{t('currentEstimate')}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">{t('occupancyTrend')}</span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-gray-900">
                {formatPercentage(occupancyRate)}
              </p>
              <p className="text-sm text-gray-500">{t('currentRate')}</p>
            </div>
          </div>
        );
      })()}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('revenueTrend')}</h3>
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('portfolioValueTrend')}</h3>
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
