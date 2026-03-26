'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, FileText, Calendar, TrendingUp, ChevronRight, DollarSign, Home, Package, ClipboardCheck, Users, AlertTriangle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@tanstack/react-query';
import { reportsService } from '@bossnyumba/api-client';

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
    href: '/reports/generate?type=revenue',
  },
  {
    id: 'maintenance',
    title: 'Maintenance Report',
    description: 'Work orders and repair costs',
    icon: BarChart3,
    href: '/reports/generate?type=maintenance',
  },
  {
    id: 'inspections',
    title: 'Inspections Report',
    description: 'Inspection completion and conditions',
    icon: FileText,
    href: '/reports/generate?type=inspections',
  },
  {
    id: 'asset_register',
    title: 'Asset Register Report',
    description: 'Occupied vs unoccupied assets by district/station',
    icon: Package,
    href: '/reports/generate?type=asset_register',
  },
  {
    id: 'condition_survey',
    title: 'Condition Survey Report',
    description: 'Asset conditions, defects, and repair estimates',
    icon: ClipboardCheck,
    href: '/reports/generate?type=condition_survey',
  },
  {
    id: 'contract_status',
    title: 'Contract Status Report',
    description: 'Valid, expired, and terminated lease contracts',
    icon: Users,
    href: '/reports/generate?type=contract_status',
  },
  {
    id: 'collections',
    title: 'Collections & Arrears Report',
    description: 'Debt aging, arrears by district, recovery rates',
    icon: AlertTriangle,
    href: '/reports/generate?type=collections',
  },
];

export default function ReportsDashboardPage() {
  const router = useRouter();
  const { data: reportsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['recent-reports'],
    queryFn: async () => {
      const response = await reportsService.list({ limit: 10 });
      return response.data;
    },
  });

  const recentReports = (reportsData ?? []).map((r: any) => ({
    id: r.id,
    name: r.name ?? r.title ?? '',
    generatedAt: r.generatedAt ?? r.createdAt ?? '',
    type: r.type ?? '',
  }));
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

      <div className="px-4 py-4 pb-24 space-y-6">
        {/* Report Types */}
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

        {/* Quick Actions */}
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

        {/* Recent Reports */}
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Recent Reports</h2>
          {isLoading ? (
            <div className="card divide-y divide-gray-100">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-4 animate-pulse flex items-center gap-3">
                  <div className="w-5 h-5 bg-gray-200 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">Failed to load reports</h3>
              <p className="text-sm text-gray-500 max-w-xs mb-6">Please check your connection and try again.</p>
              <button onClick={() => refetch()} className="btn-secondary text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          ) : recentReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">No reports generated yet</h3>
              <p className="text-sm text-gray-500 max-w-xs mb-6">Generate your first report to see it here.</p>
              <Link href="/reports/generate" className="btn-primary text-sm">Generate Report</Link>
            </div>
          ) : (
            <div className="card divide-y divide-gray-100">
              {recentReports.map((report) => (
                <div key={report.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-sm">{report.name}</div>
                      <div className="text-xs text-gray-500">
                        Generated {new Date(report.generatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => router.push('/reports/' + report.id)} className="text-sm text-primary-600">View</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
