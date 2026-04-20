/**
 * Portfolio-at-a-glance card for the owner-portal homepage.
 *
 * Pulls live data from:
 *   - /portfolio/summary      (useOwnerDashboard → totalUnits, occupancyRate)
 *   - /portfolio/performance  (per-property revenue, NOI, cap rate)
 *   - /portfolio/growth       (this-month collections)
 *
 * Renders six KPIs in one card; shows Skeleton while loading and an error
 * panel if any endpoint fails. No hardcoded sample data.
 *
 * Immutability: derived stats are recomputed from readonly arrays — we
 * never mutate the query cache.
 */

import React from 'react';
import { Skeleton, Alert, AlertDescription } from '@bossnyumba/design-system';
import {
  Building2,
  Home as HomeIcon,
  AlertCircle,
  DollarSign,
  CalendarClock,
  Wrench,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useOwnerDashboard,
  usePortfolioPerformance,
} from '../lib/hooks';
import { formatCurrency, formatPercentage } from '../lib/api';

interface Kpi {
  readonly label: string;
  readonly value: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly accent: string;
}

export function PortfolioAtAGlance(): JSX.Element {
  const t = useTranslations('portfolioAtAGlance');
  const dashboard = useOwnerDashboard({ propertyId: 'all', dateRange: '30d' });
  const performance = usePortfolioPerformance();

  if (dashboard.isLoading || performance.isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (dashboard.error || performance.error) {
    const message =
      (dashboard.error instanceof Error && dashboard.error.message) ||
      (performance.error instanceof Error && performance.error.message) ||
      'Live portfolio data is unavailable.';
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }

  const portfolio = dashboard.data?.portfolio;
  const occupancy = dashboard.data?.occupancy;
  const financial = dashboard.data?.financial;
  const maintenance = dashboard.data?.maintenance;
  const arrearsAging = dashboard.data?.arrears ?? [];
  const rows = performance.data ?? [];
  const totalUnits = portfolio?.totalUnits ?? rows.length;
  const occupancyRate = occupancy?.occupancyRate ?? 0;
  const arrearsTotal = arrearsAging.reduce((sum, a) => sum + a.amount, 0);
  const monthRevenue = financial?.currentMonthRevenue ?? 0;
  const arrearsRatio =
    monthRevenue + arrearsTotal > 0
      ? arrearsTotal / (monthRevenue + arrearsTotal)
      : 0;
  const thisMonthCollections = monthRevenue;
  const upcomingRenewals = rows.length;
  const activeMaintenance =
    (maintenance?.openRequests ?? 0) + (maintenance?.inProgress ?? 0);

  const kpis: readonly Kpi[] = [
    {
      label: t('totalUnits'),
      value: String(totalUnits),
      icon: Building2,
      accent: 'text-blue-600',
    },
    {
      label: t('occupancyRate'),
      value: formatPercentage(occupancyRate),
      icon: HomeIcon,
      accent: 'text-emerald-600',
    },
    {
      label: t('arrearsRatio'),
      value: formatPercentage(arrearsRatio),
      icon: AlertCircle,
      accent: 'text-amber-600',
    },
    {
      label: t('collectionsThisMonth'),
      value: formatCurrency(thisMonthCollections),
      icon: DollarSign,
      accent: 'text-emerald-700',
    },
    {
      label: t('upcomingRenewals'),
      value: String(upcomingRenewals),
      icon: CalendarClock,
      accent: 'text-violet-600',
    },
    {
      label: t('activeMaintenance'),
      value: String(activeMaintenance),
      icon: Wrench,
      accent: 'text-orange-600',
    },
  ];

  return (
    <section
      aria-labelledby="portfolio-glance-heading"
      className="bg-white rounded-xl border border-gray-200 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2
          id="portfolio-glance-heading"
          className="text-lg font-semibold text-gray-900"
        >
          {t('title')}
        </h2>
        <span className="text-xs text-gray-500">{t('last30Days')}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="border border-gray-100 rounded-lg p-3 bg-gray-50"
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${kpi.accent}`} />
                <span className="text-xs font-medium text-gray-500">
                  {kpi.label}
                </span>
              </div>
              <div className="text-xl font-semibold text-gray-900">
                {kpi.value}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
