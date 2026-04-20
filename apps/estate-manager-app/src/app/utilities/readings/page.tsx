'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, TrendingUp, Droplet, Zap, Flame } from 'lucide-react';
import { EmptyState } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';

type UtilityType = 'water' | 'electricity' | 'gas';

interface Reading {
  id: string;
  unit: string;
  property: string;
  utilityType: UtilityType;
  previousReading: number;
  currentReading: number;
  consumption: number;
  unitLabel: string;
  recordedAt?: string;
  status: 'recorded' | 'pending';
}

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

// Live wiring pending — meter readings endpoint not yet mounted.
// Empty array keeps the UI honest until the utilities service is plumbed.
const readings: Reading[] = [];

export default function MeterReadingsPage() {
  const [filter, setFilter] = useState<'all' | 'pending'>('pending');
  const [utilityFilter, setUtilityFilter] = useState<UtilityType | 'all'>('all');

  const filteredReadings = readings.filter((r) => {
    if (filter === 'pending' && r.status !== 'pending') return false;
    if (utilityFilter !== 'all' && r.utilityType !== utilityFilter) return false;
    return true;
  });

  const pendingCount = readings.filter((r) => r.status === 'pending').length;

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
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'pending', label: 'Pending' },
            { value: 'all', label: 'All' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as 'all' | 'pending')}
              className={`btn text-sm ${filter === tab.value ? 'btn-primary' : 'btn-secondary'}`}
            >
              {tab.label}
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

        {/* Readings List */}
        <div className="space-y-3">
          {filteredReadings.map((reading) => {
            const Icon = utilityIcons[reading.utilityType];
            return (
              <div key={reading.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Icon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-medium">Unit {reading.unit}</div>
                      <div className="text-sm text-gray-500">{reading.property}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {utilityLabels[reading.utilityType]} • {reading.unitLabel}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {reading.status === 'recorded' ? (
                      <>
                        <div className="font-medium">{reading.currentReading} {reading.unitLabel}</div>
                        <div className="text-sm text-success-600">+{reading.consumption} used</div>
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

        {filteredReadings.length === 0 && (
          <EmptyState
            icon={<TrendingUp className="h-8 w-8" />}
            title="No readings found"
            description={filter === 'pending' ? 'All readings have been recorded.' : 'Record meter readings to get started.'}
            action={
              <Link href="/utilities/readings/record" className="btn-primary inline-block">
                Record Reading
              </Link>
            }
          />
        )}
      </div>
    </>
  );
}
