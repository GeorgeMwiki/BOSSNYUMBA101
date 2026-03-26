'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, AlertTriangle, ChevronRight, Eye, Shield, Clock, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { subleaseAlertsService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

const STATUS_COLORS: Record<string, string> = {
  reported: 'bg-yellow-100 text-yellow-800',
  investigating: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-red-100 text-red-800',
  dismissed: 'bg-gray-100 text-gray-600',
  resolved: 'bg-green-100 text-green-800',
};

export default function SubleaseMonitoringPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sublease-alerts', { status: statusFilter || undefined }],
    queryFn: () => subleaseAlertsService.list({ status: statusFilter || undefined }),
    retry: false,
  });

  const alerts = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Sublease Monitoring"
        subtitle="Detect and manage unauthorized sub-leasing"
        action={
          <Link href="/subleases/report" className="btn-primary text-sm flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            Report Alert
          </Link>
        }
      />

      <div className="px-4 py-4 pb-24 space-y-4 max-w-4xl mx-auto">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {alerts.filter((a: { status?: string }) => a.status === 'reported').length}
            </div>
            <div className="text-xs text-gray-500">Reported</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {alerts.filter((a: { status?: string }) => a.status === 'investigating').length}
            </div>
            <div className="text-xs text-gray-500">Investigating</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-red-600">
              {alerts.filter((a: { status?: string }) => a.status === 'confirmed').length}
            </div>
            <div className="text-xs text-gray-500">Confirmed</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['all', 'reported', 'investigating', 'confirmed', 'dismissed', 'resolved'].map((s) => (
            <button
              key={s}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                (s === 'all' && !statusFilter) || statusFilter === s
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => setStatusFilter(s === 'all' ? '' : s)}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Alerts List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4" />
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                  </div>
                  <div className="h-5 w-20 bg-gray-200 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Failed to load alerts</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">Please check your connection and try again.</p>
            <button onClick={() => refetch()} className="btn-secondary text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No sublease alerts</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">All leases are compliant. No unauthorized sub-leasing detected.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert: {
              id: string;
              alertCode: string;
              description: string;
              status?: string;
              source?: string;
              reportedAt?: string;
              customerName?: string;
              propertyName?: string;
              suspectedSubtenantName?: string;
            }) => (
              <Link key={alert.id} href={`/subleases/${alert.id}`}>
                <div className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        alert.status === 'confirmed' ? 'bg-red-50' :
                        alert.status === 'investigating' ? 'bg-blue-50' : 'bg-yellow-50'
                      }`}>
                        <AlertTriangle className={`w-5 h-5 ${
                          alert.status === 'confirmed' ? 'text-red-600' :
                          alert.status === 'investigating' ? 'text-blue-600' : 'text-yellow-600'
                        }`} />
                      </div>
                      <div>
                        <div className="font-medium">{alert.alertCode}</div>
                        <div className="text-sm text-gray-500 line-clamp-1">{alert.description}</div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {alert.reportedAt ? new Date(alert.reportedAt).toLocaleDateString() : '—'}
                          {alert.source && <span>• {alert.source.replace(/_/g, ' ')}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[alert.status ?? 'reported']}`}>
                        {alert.status ?? 'reported'}
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
