'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, FileText, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type ReportType = 'occupancy' | 'revenue' | 'maintenance' | 'inspections';

const reportTypes: Record<ReportType, { label: string; description: string }> = {
  occupancy: { label: 'Occupancy Report', description: 'Unit occupancy rates, vacancies, and trends' },
  revenue: { label: 'Revenue Report', description: 'Rent collection, payment history, and arrears' },
  maintenance: { label: 'Maintenance Report', description: 'Work orders, costs, and completion metrics' },
  inspections: { label: 'Inspections Report', description: 'Inspection completion and condition summaries' },
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
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In real app: API call to generate report
    router.push('/reports');
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

          <div>
            <label className="label">Property (optional)</label>
            <select
              className="input"
              value={formData.propertyId}
              onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
            >
              <option value="">All Properties</option>
              <option value="1">Sunset Apartments</option>
              <option value="2">Riverside Towers</option>
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
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      </form>
    </>
  );
}
