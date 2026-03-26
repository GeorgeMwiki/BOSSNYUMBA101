'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { propertiesService, reportsService } from '@bossnyumba/api-client';
import { Download, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type ReportType = 'occupancy' | 'revenue' | 'maintenance' | 'inspections' | 'asset_register' | 'condition_survey' | 'contract_status' | 'collections';

const reportTypes: Record<ReportType, { label: string; description: string }> = {
  occupancy: { label: 'Occupancy Report', description: 'Unit occupancy rates, vacancies, and trends' },
  revenue: { label: 'Revenue Report', description: 'Rent collection, payment history, and arrears' },
  maintenance: { label: 'Maintenance Report', description: 'Work orders, costs, and completion metrics' },
  inspections: { label: 'Inspections Report', description: 'Inspection completion and condition summaries' },
  asset_register: { label: 'Asset Register Report', description: 'Occupied vs unoccupied assets by district and station' },
  condition_survey: { label: 'Condition Survey Report', description: 'Asset conditions, defects found, and repair cost estimates' },
  contract_status: { label: 'Contract Status Report', description: 'Valid, expired, and terminated lease contracts' },
  collections: { label: 'Collections & Arrears Report', description: 'Debt aging buckets, arrears by district, recovery rates' },
};

export default function GenerateReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type') as ReportType | null;

  const [formData, setFormData] = useState({
    type: (typeParam && reportTypes[typeParam] ? typeParam : 'occupancy') as ReportType,
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    format: 'pdf' as 'pdf' | 'csv' | 'excel',
    propertyId: '',
    interval: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual',
    district: '',
  });

  const { data: properties, isLoading: isLoadingProperties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const response = await propertiesService.list();
      return response.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await reportsService.export(data.type, {
        format: data.format as 'pdf' | 'csv',
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
      router.push('/reports');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateMutation.mutate(formData);
  };

  return (
    <>
      <PageHeader title="Generate Report" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">Report Type</label>
            <select
              className="input"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as ReportType })}
            >
              {(Object.entries(reportTypes) as [ReportType, { label: string }][]).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{reportTypes[formData.type].description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">From Date</label>
              <input
                type="date"
                className="input"
                value={formData.dateFrom}
                onChange={(e) => setFormData({ ...formData, dateFrom: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">To Date</label>
              <input
                type="date"
                className="input"
                value={formData.dateTo}
                onChange={(e) => setFormData({ ...formData, dateTo: e.target.value })}
                required
              />
            </div>
          </div>

          {formData.type === 'revenue' && (
            <div>
              <label className="label">Report Interval</label>
              <select
                className="input"
                value={formData.interval}
                onChange={(e) => setFormData({ ...formData, interval: e.target.value as typeof formData.interval })}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semi_annual">Semi-Annual</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          )}

          {['asset_register', 'condition_survey', 'contract_status', 'collections', 'revenue'].includes(formData.type) && (
            <div>
              <label className="label">District (optional)</label>
              <select
                className="input"
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              >
                <option value="">All Districts</option>
                <option value="DAR">Dar es Salaam</option>
                <option value="DOD">Dodoma</option>
                <option value="TAB">Tabora</option>
                <option value="TAN">Tanga</option>
              </select>
            </div>
          )}

          <div>
            <label className="label">Property (optional)</label>
            <select
              className="input"
              value={formData.propertyId}
              onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
              disabled={isLoadingProperties}
            >
              <option value="">All Properties</option>
              {properties?.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Export Format</label>
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

          {generateMutation.isError && (
            <p className="text-sm text-red-600">
              {(generateMutation.error as Error)?.message || 'Failed to generate report'}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {generateMutation.isPending ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </form>
    </>
  );
}
