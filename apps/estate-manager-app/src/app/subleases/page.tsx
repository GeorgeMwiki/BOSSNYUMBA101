'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, AlertTriangle, ChevronRight, Eye, Shield, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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

  const { data, isLoading } = useQuery({
    queryKey: ['sublease-alerts', { status: statusFilter || undefined }],
    queryFn: async () => ({ data: [], pagination: { totalItems: 0 } }),
    retry: false,
  });

  const alerts = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Sublease Monitoring"
        subtitle="Detect and manage unauthorized sub-leasing"
        action={
          <button className="btn-primary text-sm flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            Report Alert
          </button>
        }
      />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
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
          <div className="card p-8 text-center text-gray-500">Loading...</div>
        ) : alerts.length === 0 ? (
          <div className="card p-8 text-center">
            <Shield className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No sublease alerts</p>
            <p className="text-sm text-gray-400 mt-1">All leases are compliant</p>
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
