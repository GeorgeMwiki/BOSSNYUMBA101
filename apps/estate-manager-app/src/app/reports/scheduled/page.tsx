'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Calendar, Mail, FileText, ChevronRight, Edit, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { reportsService, getApiClient } from '@bossnyumba/api-client';

type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';

interface ScheduledReport {
  id: string;
  name: string;
  type: string;
  frequency: ScheduleFrequency;
  recipients: string[];
  nextRun: string;
}

const frequencyLabels: Record<ScheduleFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export default function ScheduledReportsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      await getApiClient().delete(`/reports/scheduled/${id}`);
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete report. Please try again.');
    }
    setDeletingId(null);
  };

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['scheduled-reports'],
    queryFn: async () => {
      const response = await reportsService.list({ scheduled: true });
      return response.data;
    },
  });

  const scheduledReports: ScheduledReport[] = (reportsData ?? []).map((r: any) => ({
    id: r.id,
    name: r.name ?? r.title ?? '',
    type: r.type ?? '',
    frequency: (r.frequency ?? 'monthly') as ScheduleFrequency,
    recipients: r.recipients ?? [],
    nextRun: r.nextRun ?? r.nextRunAt ?? '',
  }));

  return (
    <>
      <PageHeader
        title="Scheduled Reports"
        subtitle={`${scheduledReports.length} active`}
        showBack
        action={
          <Link href="/reports/scheduled/new" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Schedule
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4">
        {deleteError && (
          <div className="flex items-center gap-2 p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
            {deleteError}
            <button onClick={() => setDeleteError(null)} className="ml-auto text-danger-500 hover:text-danger-700">&times;</button>
          </div>
        )}
        <div className="space-y-3">
          {scheduledReports.map((report) => (
            <div key={report.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary-50 rounded-lg">
                    <FileText className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <div className="font-medium">{report.name}</div>
                    <span className="badge-gray text-xs mt-1">{frequencyLabels[report.frequency]}</span>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                      <Mail className="w-4 h-4" />
                      {report.recipients.join(', ')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                      <Calendar className="w-4 h-4" />
                      Next run: {new Date(report.nextRun).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => router.push(`/reports/scheduled/${report.id}/edit`)} className="p-2 rounded-lg hover:bg-gray-100">
                    <Edit className="w-4 h-4 text-gray-500" />
                  </button>
                  <button onClick={() => handleDelete(report.id)} disabled={deletingId === report.id} className="p-2 rounded-lg hover:bg-danger-50 text-danger-600 disabled:opacity-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {scheduledReports.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No scheduled reports</h3>
            <p className="text-sm text-gray-500 mt-1">
              Schedule reports to be generated and delivered automatically
            </p>
            <Link href="/reports/scheduled/new" className="btn-primary mt-4 inline-block">
              Schedule Report
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
