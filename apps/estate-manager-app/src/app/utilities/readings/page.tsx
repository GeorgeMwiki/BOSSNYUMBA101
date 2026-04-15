'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  TrendingUp,
  Droplet,
  Zap,
  Flame,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { utilitiesApi, type MeterReading, type UtilityType } from '@/lib/api';

const utilityIcons: Record<UtilityType, React.ElementType> = {
  water: Droplet,
  electricity: Zap,
  gas: Flame,
};

const utilityLabels: Record<UtilityType, string> = {
  water: 'Water',
  electricity: 'Electricity',
  gas: 'Gas',
};

export default function MeterReadingsPage() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'recorded'>('pending');
  const [utilityFilter, setUtilityFilter] = useState<UtilityType | 'all'>('all');

  const readingsQuery = useQuery({
    queryKey: ['meter-readings', filter, utilityFilter],
    queryFn: () =>
      utilitiesApi.listReadings({
        status: filter === 'all' ? undefined : filter,
        utilityType: utilityFilter === 'all' ? undefined : utilityFilter,
      }),
    retry: false,
  });

  const response = readingsQuery.data;
  const readings: MeterReading[] = response?.data ?? [];
  const pendingCount = readings.filter((r) => r.status === 'pending').length;

  const errorMessage =
    readingsQuery.error instanceof Error
      ? readingsQuery.error.message
      : response && !response.success
      ? response.error?.message
      : undefined;

  return (
    <>
      <PageHeader
        title="Meter Readings"
        subtitle={pendingCount > 0 ? `${pendingCount} pending` : 'All recorded'}
        showBack
        action={
          <Link href="/utilities/readings/record" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Record
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {(['pending', 'recorded', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`btn text-sm ${filter === tab ? 'btn-primary' : 'btn-secondary'}`}
            >
              {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
          <span className="border-l border-gray-200 mx-2" />
          {(Object.entries(utilityLabels) as [UtilityType, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setUtilityFilter(utilityFilter === value ? 'all' : value)}
              className={`btn text-sm ${utilityFilter === value ? 'btn-primary' : 'btn-secondary'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {readingsQuery.isLoading && (
          <div className="card p-4 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading meter readings...
          </div>
        )}

        {errorMessage && (
          <div className="card p-4 flex items-start gap-2 border-danger-200 bg-danger-50 text-danger-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Unable to load readings</div>
              <div>{errorMessage}</div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {readings.map((reading) => {
            const Icon = utilityIcons[reading.utilityType];
            return (
              <div key={reading.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Icon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-medium">Unit {reading.unit.unitNumber}</div>
                      <div className="text-sm text-gray-500">
                        {reading.property?.name ?? '—'}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {utilityLabels[reading.utilityType]} • {reading.unitLabel}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {reading.status === 'recorded' ? (
                      <>
                        <div className="font-medium">
                          {reading.currentReading} {reading.unitLabel}
                        </div>
                        <div className="text-sm text-success-600">
                          +{reading.consumption} used
                        </div>
                        {reading.recordedAt && (
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(reading.recordedAt).toLocaleDateString()}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="badge-warning">Pending</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!readingsQuery.isLoading && !errorMessage && readings.length === 0 && (
          <div className="text-center py-12">
            <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No readings found</h3>
            <p className="text-sm text-gray-500 mt-1">
              {filter === 'pending'
                ? 'All readings have been recorded'
                : 'Record meter readings to get started'}
            </p>
            <Link href="/utilities/readings/record" className="btn-primary mt-4 inline-block">
              Record Reading
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
