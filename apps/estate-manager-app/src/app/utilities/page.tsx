'use client';

import Link from 'next/link';
import { Droplet, Zap, Flame, ChevronRight, TrendingUp, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

type UtilityType = 'water' | 'electricity' | 'gas';
type StatusKey = 'ok' | 'warning' | 'alert';

interface UtilitySummary {
  type: UtilityType;
  nameKey: 'utilWater' | 'utilElectricity' | 'utilGas';
  icon: React.ElementType;
  totalUnits: number;
  totalConsumption: number;
  unit: string;
  status: StatusKey;
  pendingReadings: number;
}

const utilities: UtilitySummary[] = [
  {
    type: 'water',
    nameKey: 'utilWater',
    icon: Droplet,
    totalUnits: 24,
    totalConsumption: 12450,
    unit: 'm³',
    status: 'ok',
    pendingReadings: 2,
  },
  {
    type: 'electricity',
    nameKey: 'utilElectricity',
    icon: Zap,
    totalUnits: 24,
    totalConsumption: 8560,
    unit: 'kWh',
    status: 'warning',
    pendingReadings: 5,
  },
  {
    type: 'gas',
    nameKey: 'utilGas',
    icon: Flame,
    totalUnits: 8,
    totalConsumption: 320,
    unit: 'm³',
    status: 'ok',
    pendingReadings: 0,
  },
];

const statusLabelKey: Record<StatusKey, 'statusOk' | 'statusWarning' | 'statusAlert'> = {
  ok: 'statusOk',
  warning: 'statusWarning',
  alert: 'statusAlert',
};
const statusColor: Record<StatusKey, string> = {
  ok: 'badge-success',
  warning: 'badge-warning',
  alert: 'badge-danger',
};

export default function UtilitiesOverviewPage() {
  const t = useTranslations('utilitiesOverview');
  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
      />

      <div className="px-4 py-4 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {utilities.map((util) => {
            const Icon = util.icon;
            return (
              <div key={util.type} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 rounded-lg">
                      <Icon className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <div className="font-medium">{t(util.nameKey)}</div>
                      <div className="text-2xl font-bold mt-1">
                        {util.totalConsumption.toLocaleString()} {util.unit}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {t('unitsThisMonth', { count: util.totalUnits })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className={statusColor[util.status]}>{t(statusLabelKey[util.status])}</span>
                  {util.pendingReadings > 0 && (
                    <span className="text-sm text-gray-500">
                      {t('pendingLabel', { count: util.pendingReadings })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">{t('quickActions')}</h2>
          <div className="space-y-3">
            <Link href="/utilities/readings">
              <div className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <div className="p-2 bg-primary-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{t('recordReadings')}</div>
                  <div className="text-sm text-gray-500">{t('recordReadingsDesc')}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </Link>
            <Link href="/utilities/bills">
              <div className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <div className="p-2 bg-success-50 rounded-lg">
                  <Zap className="w-5 h-5 text-success-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{t('utilityBills')}</div>
                  <div className="text-sm text-gray-500">{t('utilityBillsDesc')}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </Link>
          </div>
        </section>

        {/* Alerts */}
        <div className="card p-4 border-warning-200 bg-warning-50/50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-warning-800">{t('alertTitle')}</div>
              <div className="text-sm text-warning-700 mt-1">
                {t('alertDesc')}
              </div>
              <Link href="/utilities/readings" className="text-sm text-primary-600 font-medium mt-2 inline-block">
                {t('recordReadingsLink')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
