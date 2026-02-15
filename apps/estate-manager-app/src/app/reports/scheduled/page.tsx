'use client';

import Link from 'next/link';
import { ArrowLeft, Plus, Calendar, Mail, FileText, ChevronRight, Edit, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';

interface ScheduledReport {
  id: string;
  name: string;
  type: string;
  frequency: ScheduleFrequency;
  recipients: string[];
  nextRun: string;
}

// Mock data - replace with API
const scheduledReports: ScheduledReport[] = [
  {
    id: '1',
    name: 'Weekly Occupancy Summary',
    type: 'occupancy',
    frequency: 'weekly',
    recipients: ['manager@estate.com'],
    nextRun: '2024-02-26',
  },
  {
    id: '2',
    name: 'Monthly Revenue Report',
    type: 'revenue',
    frequency: 'monthly',
    recipients: ['manager@estate.com', 'accounting@estate.com'],
    nextRun: '2024-03-01',
  },
];

const frequencyLabels: Record<ScheduleFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export default function ScheduledReportsPage() {
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
                  <button className="p-2 rounded-lg hover:bg-gray-100">
                    <Edit className="w-4 h-4 text-gray-500" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-danger-50 text-danger-600">
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
