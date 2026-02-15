'use client';

import Link from 'next/link';
import { BarChart3, FileText, Calendar, TrendingUp, ChevronRight, DollarSign, Home } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

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
];

// Mock data
const recentReports = [
  { id: '1', name: 'Occupancy - Feb 2024', generatedAt: '2024-02-25', type: 'occupancy' },
  { id: '2', name: 'Revenue - Jan 2024', generatedAt: '2024-02-01', type: 'revenue' },
  { id: '3', name: 'Maintenance - Q4 2023', generatedAt: '2024-01-15', type: 'maintenance' },
];

export default function ReportsDashboardPage() {
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
                <button className="text-sm text-primary-600">View</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
