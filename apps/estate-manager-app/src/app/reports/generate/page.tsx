'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { propertiesService, reportsService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/providers/AuthProvider';
import { tenantKey } from '@/lib/tenant-scoped-key';

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
  const { tenant } = useAuth();
  const typeParam = searchParams?.get('type') as ReportType | null;

  const [formData, setFormData] = useState({
    type: (typeParam && reportTypeKeys[typeParam] ? typeParam : 'occupancy') as ReportType,
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    format: 'pdf' as 'pdf' | 'csv' | 'excel',
    propertyId: '',
  });

  const propertiesQuery = useQuery({
    queryKey: tenantKey(tenant?.id, 'reports-generate-properties'),
    queryFn: () => propertiesService.list({ page: 1, pageSize: 100 }),
    retry: false,
  });

  const properties = Array.isArray(propertiesQuery.data?.data)
    ? propertiesQuery.data!.data!
    : [];

  const exportMutation = useMutation({
    mutationFn: (vars: { readonly type: ReportType; readonly format: 'csv' | 'pdf' }) => {
      // The gateway exposes GET /api/v1/reports/export/:type which
      // returns a signed download URL. The current page collects extra
      // dimensions (date range, propertyId) that the export endpoint
      // does not yet accept — once the backend supports filters we
      // forward them here. Until then we still trigger the existing
      // export so the UI returns a real artefact instead of a no-op.
      return reportsService.export(vars.type, { format: vars.format });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Excel is not in the gateway's ReportFormat union — fall back to
    // CSV so the request shape stays valid.
    const format: 'csv' | 'pdf' =
      formData.format === 'excel' ? 'csv' : formData.format;
    try {
      const res = (await exportMutation.mutateAsync({
        type: formData.type,
        format,
      })) as { data?: { downloadUrl?: string } } | undefined;
      const url = res?.data?.downloadUrl;
      if (typeof url === 'string' && url.length > 0) {
        if (typeof window !== 'undefined') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      }
    } catch {
      // The mutation surfaces the error via React Query state; the UI
      // does not interrupt navigation.
    } finally {
      router.push('/reports');
    }
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
              onChange={(e) =>
                setFormData({ ...formData, propertyId: e.target.value })
              }
              disabled={propertiesQuery.isLoading}
            >
              <option value="">{t('allProperties')}</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
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
