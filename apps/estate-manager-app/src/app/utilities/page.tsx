'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getApiClient } from '@bossnyumba/api-client';
import { Droplet, Zap, Flame, ChevronRight, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type UtilityType = 'water' | 'electricity' | 'gas';

interface UtilitySummary {
  type: UtilityType;
  name: string;
  totalUnits: number;
  totalConsumption: number;
  unit: string;
  status: 'ok' | 'warning' | 'alert';
  pendingReadings: number;
}

const iconMap: Record<UtilityType, React.ElementType> = {
  water: Droplet,
  electricity: Zap,
  gas: Flame,
};

const statusConfig = {
  ok: { label: 'On Track', color: 'badge-success' },
  warning: { label: 'Pending Readings', color: 'badge-warning' },
  alert: { label: 'Overdue', color: 'badge-danger' },
};

export default function UtilitiesOverviewPage() {
  const { data: utilities, isLoading, isError } = useQuery({
    queryKey: ['utilities-summary'],
    queryFn: async () => {
      const response = await getApiClient().get<UtilitySummary[]>('/utilities/summary');
      return response.data;
    },
  });

  const totalPendingReadings = utilities?.reduce((sum, u) => sum + u.pendingReadings, 0) ?? 0;
  const pendingUtilities = utilities?.filter((u) => u.pendingReadings > 0) ?? [];

  return (
    <>
      <PageHeader
        title="Utilities"
        subtitle="Track consumption & bills"
      />

      <div className="px-4 py-4 space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        )}

        {isError && (
          <div className="card p-4 text-center">
            <p className="text-red-600">Failed to load utilities data. Please try again.</p>
          </div>
        )}

        {utilities && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {utilities.map((util) => {
                const Icon = iconMap[util.type] ?? Zap;
                const status = statusConfig[util.status];
                return (
                  <div key={util.type} className="card p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-50 rounded-lg">
                          <Icon className="w-6 h-6 text-primary-600" />
                        </div>
                        <div>
                          <div className="font-medium">{util.name}</div>
                          <div className="text-2xl font-bold mt-1">
                            {util.totalConsumption.toLocaleString()} {util.unit}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {util.totalUnits} units - This month
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <span className={status.color}>{status.label}</span>
                      {util.pendingReadings > 0 && (
                        <span className="text-sm text-gray-500">
                          {util.pendingReadings} pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions */}
            <section>
              <h2 className="text-sm font-medium text-gray-500 mb-3">Quick Actions</h2>
              <div className="space-y-3">
                <Link href="/utilities/readings">
                  <div className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                    <div className="p-2 bg-primary-50 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">Record Meter Readings</div>
                      <div className="text-sm text-gray-500">Submit readings for all units</div>
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
                      <div className="font-medium">Utility Bills</div>
                      <div className="text-sm text-gray-500">View and manage bill history</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </Link>
              </div>
            </section>

            {/* Alerts */}
            {totalPendingReadings > 0 && (
              <div className="card p-4 border-warning-200 bg-warning-50/50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-warning-800">{totalPendingReadings} units need meter readings</div>
                    <div className="text-sm text-warning-700 mt-1">
                      {pendingUtilities.map((u) => `${u.name}: ${u.pendingReadings} pending`).join(', ')}
                    </div>
                    <Link href="/utilities/readings" className="text-sm text-primary-600 font-medium mt-2 inline-block">
                      Record readings &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
