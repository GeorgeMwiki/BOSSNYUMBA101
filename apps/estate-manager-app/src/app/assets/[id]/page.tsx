'use client';

import { useParams } from 'next/navigation';
import { Package, MapPin, DollarSign, ClipboardCheck, Calendar, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { assetsService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

function formatDate(date: string | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-TZ', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(amount / 100);
}

const CONDITION_COLORS: Record<string, string> = {
  excellent: 'bg-green-100 text-green-800',
  good: 'bg-blue-100 text-blue-800',
  fair: 'bg-yellow-100 text-yellow-800',
  poor: 'bg-orange-100 text-orange-800',
  condemned: 'bg-red-100 text-red-800',
  not_assessed: 'bg-gray-100 text-gray-800',
};

export default function AssetDetailPage() {
  const params = useParams();
  const assetId = params.id as string;

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => assetsService.get(assetId).then(r => r.data),
    retry: false,
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Asset Detail" showBack />
        <div className="px-4 py-8 text-center text-gray-500">Loading...</div>
      </>
    );
  }

  const a = asset as Record<string, unknown> | null;

  return (
    <>
      <PageHeader title={(a?.name as string) ?? 'Asset Detail'} showBack />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        {/* Condition Badge */}
        <div className="card p-5 text-center">
          <div className="text-sm text-gray-500 mb-1">Current Condition</div>
          <span className={`inline-block text-lg px-4 py-1 rounded-full font-semibold ${CONDITION_COLORS[(a?.currentCondition as string) ?? 'not_assessed']}`}>
            {((a?.currentCondition as string) ?? 'Not Assessed').replace(/_/g, ' ')}
          </span>
          <div className="text-xs text-gray-400 mt-2">
            Last surveyed: {formatDate(a?.lastSurveyDate as string)}
          </div>
        </div>

        {/* Asset Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Package className="w-4 h-4" /> Asset Info
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Code</span><span className="font-medium">{(a?.assetCode as string) ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium">{(a?.type as string) ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Occupancy</span><span className="font-medium">{(a?.occupancyStatus as string) ?? '—'}</span></div>
            </div>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Financial
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Acquisition Cost</span><span className="font-medium">{a?.acquisitionCost ? formatCurrency(a.acquisitionCost as number) : '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Book Value</span><span className="font-medium">{a?.currentBookValue ? formatCurrency(a.currentBookValue as number) : '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Monthly Rent</span><span className="font-medium">{a?.monthlyRentAmount ? formatCurrency(a.monthlyRentAmount as number) : '—'}</span></div>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Location
          </h3>
          <div className="text-sm text-gray-600">{(a?.location as string) ?? 'No location data'}</div>
        </div>

        {/* Current Occupant */}
        {a?.currentCustomerId && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <User className="w-4 h-4" /> Current Occupant
            </h3>
            <div className="text-sm">Linked to customer and lease records</div>
          </div>
        )}

        {/* Survey History */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" /> Condition Survey History
          </h3>
          <div className="text-center py-6 text-gray-400 text-sm">
            <Calendar className="w-8 h-8 mx-auto mb-2" />
            No survey records yet
          </div>
        </div>
      </div>
    </>
  );
}
