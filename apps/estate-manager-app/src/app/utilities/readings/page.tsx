'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, TrendingUp, Droplet, Zap, Flame } from 'lucide-react';
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

// Mock data - replace with API
const readings: Reading[] = [
  { id: '1', unit: 'A-301', property: 'Sunset Apartments', utilityType: 'water', previousReading: 45, currentReading: 52, consumption: 7, unitLabel: 'm³', recordedAt: '2024-02-25', status: 'recorded' },
  { id: '2', unit: 'A-301', property: 'Sunset Apartments', utilityType: 'electricity', previousReading: 320, currentReading: 385, consumption: 65, unitLabel: 'kWh', recordedAt: '2024-02-25', status: 'recorded' },
  { id: '3', unit: 'A-102', property: 'Sunset Apartments', utilityType: 'electricity', previousReading: 0, currentReading: 0, consumption: 0, unitLabel: 'kWh', status: 'pending' },
  { id: '4', unit: 'B-105', property: 'Sunset Apartments', utilityType: 'water', previousReading: 28, currentReading: 31, consumption: 3, unitLabel: 'm³', recordedAt: '2024-02-24', status: 'recorded' },
  { id: '5', unit: 'C-202', property: 'Sunset Apartments', utilityType: 'electricity', previousReading: 0, currentReading: 0, consumption: 0, unitLabel: 'kWh', status: 'pending' },
];

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
          <div className="text-center py-12">
            <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No readings found</h3>
            <p className="text-sm text-gray-500 mt-1">
              {filter === 'pending' ? 'All readings have been recorded' : 'Record meter readings to get started'}
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
