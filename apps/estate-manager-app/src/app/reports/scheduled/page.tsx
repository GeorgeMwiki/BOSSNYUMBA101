'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Calendar,
  Mail,
  FileText,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { reportsApi, type ScheduledReport, type ReportFrequency } from '@/lib/api';

const frequencyLabels: Record<ReportFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

export default function ScheduledReportsPage() {
  const queryClient = useQueryClient();

  const scheduledQuery = useQuery({
    queryKey: ['reports-scheduled'],
    queryFn: () => reportsApi.listScheduled(),
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportsApi.deleteScheduled(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reports-scheduled'] });
    },
  });

  const response = scheduledQuery.data;
  const scheduledReports: ScheduledReport[] = response?.data ?? [];
  const errorMessage =
    scheduledQuery.error instanceof Error
      ? scheduledQuery.error.message
      : response && !response.success
      ? response.error?.message
      : undefined;

  return (
    <>
      <PageHeader
        title="Scheduled Reports"
        subtitle={scheduledReports.length > 0 ? `${scheduledReports.length} active` : undefined}
        showBack
        action={
          <Link href="/reports/scheduled/new" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Schedule
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4">
        {scheduledQuery.isLoading && (
          <div className="card p-4 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading scheduled reports...
          </div>
        )}

        {errorMessage && (
          <div className="card p-4 flex items-start gap-2 border-danger-200 bg-danger-50 text-danger-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Unable to load scheduled reports</div>
              <div>{errorMessage}</div>
            </div>
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
                    <span className="badge-gray text-xs mt-1">
                      {frequencyLabels[report.frequency]}
                    </span>
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
                  <Link
                    href={`/reports/scheduled/${report.id}/edit`}
                    className="p-2 rounded-lg hover:bg-gray-100"
                  >
                    <Edit className="w-4 h-4 text-gray-500" />
                  </Link>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete scheduled report "${report.name}"?`)) {
                        deleteMutation.mutate(report.id);
                      }
                    }}
                    disabled={deleteMutation.isPending && deleteMutation.variables === report.id}
                    className="p-2 rounded-lg hover:bg-danger-50 text-danger-600"
                  >
                    {deleteMutation.isPending && deleteMutation.variables === report.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!scheduledQuery.isLoading && !errorMessage && scheduledReports.length === 0 && (
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
