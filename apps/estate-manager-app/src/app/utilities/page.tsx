'use client';

import Link from 'next/link';
import { Droplet, Zap, Flame, ChevronRight, TrendingUp, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type UtilityType = 'water' | 'electricity' | 'gas';

interface UtilitySummary {
  type: UtilityType;
  name: string;
  icon: React.ElementType;
  totalUnits: number;
  totalConsumption: number;
  unit: string;
  status: 'ok' | 'warning' | 'alert';
  pendingReadings: number;
}

const utilities: UtilitySummary[] = [
  {
    type: 'water',
    name: 'Water',
    icon: Droplet,
    totalUnits: 24,
    totalConsumption: 12450,
    unit: 'm³',
    status: 'ok',
    pendingReadings: 2,
  },
  {
    type: 'electricity',
    name: 'Electricity',
    icon: Zap,
    totalUnits: 24,
    totalConsumption: 8560,
    unit: 'kWh',
    status: 'warning',
    pendingReadings: 5,
  },
  {
    type: 'gas',
    name: 'Gas',
    icon: Flame,
    totalUnits: 8,
    totalConsumption: 320,
    unit: 'm³',
    status: 'ok',
    pendingReadings: 0,
  },
];

const statusConfig = {
  ok: { label: 'On Track', color: 'badge-success' },
  warning: { label: 'Pending Readings', color: 'badge-warning' },
  alert: { label: 'Overdue', color: 'badge-danger' },
};

export default function UtilitiesOverviewPage() {
  return (
    <>
      <PageHeader
        title="Utilities"
        subtitle="Track consumption & bills"
      />

      <div className="px-4 py-4 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {utilities.map((util) => {
            const Icon = util.icon;
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
                        {util.totalUnits} units • This month
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
        <div className="card p-4 border-warning-200 bg-warning-50/50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-warning-800">5 units need meter readings</div>
              <div className="text-sm text-warning-700 mt-1">
                Electricity readings overdue for Unit A-102, B-201, C-301, C-305, C-402
              </div>
              <Link href="/utilities/readings" className="text-sm text-primary-600 font-medium mt-2 inline-block">
                Record readings →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
