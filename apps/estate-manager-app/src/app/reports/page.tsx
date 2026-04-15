'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  FileText,
  Calendar,
  TrendingUp,
  ChevronRight,
  DollarSign,
  Home,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { reportsApi } from '@/lib/api';

interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
}

const reportTypes: ReportCard[] = [
  {
    id: 'occupancy',
    title: 'Occupancy Report',
    description: 'Unit occupancy rates and vacancies',
    icon: Home,
    href: '/reports/generate?type=occupancy',
  },
  {
    id: 'revenue',
    title: 'Revenue Report',
    description: 'Rent collection and payment history',
    icon: DollarSign,
    href: '/reports/generate?type=financial',
  },
  {
    id: 'maintenance',
    title: 'Maintenance Report',
    description: 'Work orders and repair costs',
    icon: BarChart3,
    href: '/reports/generate?type=maintenance',
  },
  {
    id: 'statements',
    title: 'Owner Statements',
    description: 'Owner payout and NOI statements',
    icon: FileText,
    href: '/reports/generate?type=statements',
  },
];

export default function ReportsDashboardPage() {
  const recentQuery = useQuery({
    queryKey: ['reports-recent'],
    queryFn: () => reportsApi.listRecent(),
    retry: false,
  });

  const recent = recentQuery.data?.data ?? [];
  const errorMessage =
    recentQuery.error instanceof Error
      ? recentQuery.error.message
      : recentQuery.data && !recentQuery.data.success
      ? recentQuery.data.error?.message
      : undefined;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Analytics & insights"
        action={
          <Link href="/reports/generate" className="btn-primary text-sm flex items-center gap-1">
            <FileText className="w-4 h-4" />
            Generate
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-6">
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Report Types</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {reportTypes.map((report) => {
              const Icon = report.icon;
              return (
                <Link key={report.id} href={report.href}>
                  <div className="card p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary-50 rounded-lg">
                        <Icon className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{report.title}</div>
                        <div className="text-sm text-gray-500 mt-1">{report.description}</div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/reports/generate">
              <div className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow border-primary-200 bg-primary-50/30">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Generate New Report</div>
                  <div className="text-sm text-gray-500">Choose report type and date range</div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </Link>
            <Link href="/reports/scheduled">
              <div className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <div className="p-2 bg-success-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-success-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Scheduled Reports</div>
                  <div className="text-sm text-gray-500">Manage automated report delivery</div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </Link>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Recent Reports</h2>
          {recentQuery.isLoading && (
            <div className="card p-4 flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading recent reports...
            </div>
          )}
          {errorMessage && (
            <div className="card p-4 flex items-start gap-2 border-warning-200 bg-warning-50 text-warning-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>Recent reports are not yet available: {errorMessage}</div>
            </div>
          )}
          {!recentQuery.isLoading && !errorMessage && (
            <div className="card divide-y divide-gray-100">
              {recent.length === 0 && (
                <div className="p-4 text-sm text-gray-500">
                  No reports generated yet. Create one to get started.
                </div>
              )}
              {recent.map((report: any) => (
                <div
                  key={report.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-sm">{report.name}</div>
                      <div className="text-xs text-gray-500">
                        Generated {new Date(report.generatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  {report.downloadUrl ? (
                    <a
                      href={report.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600"
                    >
                      Download
                    </a>
                  ) : (
                    <Link
                      href={`/reports/generate?type=${encodeURIComponent(report.type)}`}
                      className="text-sm text-primary-600"
                    >
                      View
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
