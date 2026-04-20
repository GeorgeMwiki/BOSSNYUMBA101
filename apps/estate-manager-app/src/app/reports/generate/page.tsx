'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

type ReportType = 'occupancy' | 'revenue' | 'maintenance' | 'inspections';

const reportTypeKeys: Record<ReportType, {
  labelKey: 'occupancyTitle' | 'revenueTitle' | 'maintenanceTitle' | 'inspectionsTitle';
  descKey: 'occupancyDesc' | 'revenueDesc' | 'maintenanceDesc' | 'inspectionsDesc';
}> = {
  occupancy: { labelKey: 'occupancyTitle', descKey: 'occupancyDesc' },
  revenue: { labelKey: 'revenueTitle', descKey: 'revenueDesc' },
  maintenance: { labelKey: 'maintenanceTitle', descKey: 'maintenanceDesc' },
  inspections: { labelKey: 'inspectionsTitle', descKey: 'inspectionsDesc' },
};

function GenerateReportPageInner() {
  const t = useTranslations('reportGenerate');
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams?.get('type') as ReportType | null;

  const [formData, setFormData] = useState({
    type: (typeParam && reportTypeKeys[typeParam] ? typeParam : 'occupancy') as ReportType,
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    format: 'pdf' as 'pdf' | 'csv' | 'excel',
    propertyId: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In real app: API call to generate report
    router.push('/reports');
  };

  return (
    <>
      <PageHeader title={t('title')} showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">{t('reportType')}</label>
            <select
              className="input"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as ReportType })}
            >
              {(Object.entries(reportTypeKeys) as [ReportType, { labelKey: 'occupancyTitle' | 'revenueTitle' | 'maintenanceTitle' | 'inspectionsTitle' }][]).map(([value, { labelKey }]) => (
                <option key={value} value={value}>{t(labelKey)}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{t(reportTypeKeys[formData.type].descKey)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('fromDate')}</label>
              <input
                type="date"
                className="input"
                value={formData.dateFrom}
                onChange={(e) => setFormData({ ...formData, dateFrom: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">{t('toDate')}</label>
              <input
                type="date"
                className="input"
                value={formData.dateTo}
                onChange={(e) => setFormData({ ...formData, dateTo: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">{t('property')}</label>
            <select
              className="input"
              value={formData.propertyId}
              onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
            >
              <option value="">{t('allProperties')}</option>
              <option value="1">Sunset Apartments</option>
              <option value="2">Riverside Towers</option>
            </select>
          </div>

          <div>
            <label className="label">{t('exportFormat')}</label>
            <select
              className="input"
              value={formData.format}
              onChange={(e) => setFormData({ ...formData, format: e.target.value as 'pdf' | 'csv' | 'excel' })}
            >
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            {t('cancel')}
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            {t('generateReport')}
          </button>
        </div>
      </form>
    </>
  );
}

function GenerateReportFallback() {
  const t = useTranslations('reportGenerate');
  return <PageHeader title={t('title')} showBack />;
}

export default function GenerateReportPage() {
  return (
    <Suspense fallback={<GenerateReportFallback />}>
      <GenerateReportPageInner />
    </Suspense>
  );
}
