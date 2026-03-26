'use client';

import { useParams, useRouter } from 'next/navigation';
import { ClipboardCheck, User, Calendar, Camera, Package, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { conditionSurveysService } from '@bossnyumba/api-client';
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
};

export default function SurveyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const surveyId = params.id as string;

  const { data: survey, isLoading } = useQuery({
    queryKey: ['condition-survey', surveyId],
    queryFn: () => conditionSurveysService.get(surveyId).then(r => r.data),
    retry: false,
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Survey Detail" showBack />
        <div className="px-4 py-4 space-y-4 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </>
    );
  }

  const s = survey as Record<string, unknown> | null;
  const progress = (s?.totalAssets as number) ? Math.round((((s?.completedAssets as number) ?? 0) / (s?.totalAssets as number)) * 100) : 0;

  return (
    <>
      <PageHeader title={(s?.title as string) ?? 'Condition Survey'} showBack />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        {/* Progress */}
        <div className="card p-5">
          <div className="text-center mb-3">
            <div className="text-3xl font-bold text-indigo-600">{progress}%</div>
            <div className="text-sm text-gray-500">Survey Progress</div>
          </div>
          <div className="bg-gray-100 rounded-full h-3">
            <div className="bg-indigo-500 rounded-full h-3 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{(s?.completedAssets as number) ?? 0} completed</span>
            <span>{(s?.totalAssets as number) ?? 0} total</span>
          </div>
        </div>

        {/* Survey Info */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" /> Survey Details
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-gray-500">Code</div><div className="font-medium">{(s?.surveyCode as string) ?? '—'}</div></div>
            <div><div className="text-gray-500">Financial Year</div><div className="font-medium">{(s?.financialYear as string) ?? '—'}</div></div>
            <div><div className="text-gray-500">Start Date</div><div className="font-medium">{formatDate(s?.actualStartDate as string ?? s?.plannedStartDate as string)}</div></div>
            <div><div className="text-gray-500">End Date</div><div className="font-medium">{formatDate(s?.actualEndDate as string ?? s?.plannedEndDate as string)}</div></div>
          </div>
        </div>

        {/* Lead Surveyor */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <User className="w-4 h-4" /> Survey Team
          </h3>
          <div className="text-sm text-gray-500">{(s?.leadSurveyorName as string) || 'No surveyor assigned yet'}</div>
        </div>

        {/* Estimated Repair Costs */}
        {(s?.totalEstimatedRepairCost as number) > 0 && (
          <div className="card p-4 bg-orange-50 border-orange-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <div>
                <div className="font-medium text-orange-800">Total Estimated Repair Cost</div>
                <div className="text-lg font-bold text-orange-700">{formatCurrency(s?.totalEstimatedRepairCost as number)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Survey Items */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" /> Surveyed Assets
          </h3>
          {(s?.items as unknown[])?.length ? (
            <div className="text-sm text-gray-600">
              {((s?.items as unknown[]) ?? []).length} assets surveyed
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm">
              <Camera className="w-8 h-8 mx-auto mb-2" />
              No survey items recorded yet
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button onClick={async () => {
            const client = (await import('@bossnyumba/api-client')).getApiClient();
            const res = await client.get<{ url: string }>(`/condition-surveys/${surveyId}/export`);
            if (res.data?.url) window.open(res.data.url, '_blank');
          }} className="btn-secondary flex-1">Export Report</button>
          <button onClick={() => router.push(`/assets/surveys/${surveyId}/conduct`)} className="btn-primary flex-1">Conduct Survey</button>
        </div>
      </div>
    </>
  );
}
