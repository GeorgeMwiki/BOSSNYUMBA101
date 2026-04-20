'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

export default function DashboardPage() {
  const t = useTranslations('simple');
  const tMisc = useTranslations('misc');
  return (
    <>
      <PageHeader title={t('operationsDashboard')} />
      <div className="px-4 py-4 pb-24">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">{tMisc('liveDataUnavailable')}</p>
              <p className="text-sm text-red-700 mt-1">
                This dashboard used static operational metrics. It is disabled until live SLA,
                alerts, and task feeds are connected.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
