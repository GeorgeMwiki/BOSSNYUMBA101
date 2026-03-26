'use client';

import { useQuery } from '@tanstack/react-query';
import { slaService } from '@bossnyumba/api-client';
import type { SLAMetrics, SLAHealthCheck } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';
import { BarChart3, Clock, CheckCircle, AlertTriangle, Shield } from 'lucide-react';

export default function SLADashboardPage() {
  const { data: metricsData, isLoading } = useQuery({
    queryKey: ['sla-metrics'],
    queryFn: () => slaService.getMetrics('week'),
    retry: false,
  });

  const { data: healthData } = useQuery({
    queryKey: ['sla-health'],
    queryFn: () => slaService.getHealthCheck(),
    retry: false,
  });

  const { data: configData } = useQuery({
    queryKey: ['sla-config'],
    queryFn: () => slaService.getConfig(),
    retry: false,
  });

  const metrics = metricsData?.data as SLAMetrics | undefined;
  const health = healthData?.data as SLAHealthCheck | undefined;
  const configs = (configData?.data ?? []) as Array<{ priority: string; responseTimeMinutes: number; resolutionTimeMinutes: number }>;

  return (
    <>
      <PageHeader title="SLA Dashboard" subtitle="Service level agreement monitoring" />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-4 text-center">
            <BarChart3 className="w-6 h-6 mx-auto text-primary-600 mb-1" />
            <div className="text-2xl font-bold">
              {isLoading ? '—' : `${(metrics?.overall?.resolutionComplianceRate ?? 0).toFixed(0)}%`}
            </div>
            <div className="text-xs text-gray-500">Resolution Compliance</div>
          </div>
          <div className="card p-4 text-center">
            <Clock className="w-6 h-6 mx-auto text-yellow-600 mb-1" />
            <div className="text-2xl font-bold">
              {isLoading ? '—' : `${Math.round((metrics?.overall?.averageResolutionTimeMinutes ?? 0) / 60)}h`}
            </div>
            <div className="text-xs text-gray-500">Avg Resolution</div>
          </div>
          <div className="card p-4 text-center">
            <CheckCircle className="w-6 h-6 mx-auto text-green-600 mb-1" />
            <div className="text-2xl font-bold">
              {isLoading ? '—' : String(metrics?.overall?.completedWorkOrders ?? 0)}
            </div>
            <div className="text-xs text-gray-500">Completed</div>
          </div>
          <div className="card p-4 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto text-red-600 mb-1" />
            <div className="text-2xl font-bold">
              {isLoading ? '—' : String((metrics?.breaches?.responseBreaches ?? 0) + (metrics?.breaches?.resolutionBreaches ?? 0))}
            </div>
            <div className="text-xs text-gray-500">Breaches</div>
          </div>
        </div>

        {/* At Risk Items */}
        {(health?.atRisk?.length ?? 0) > 0 && (
          <div className="card p-4 bg-yellow-50 border-yellow-200">
            <h3 className="text-sm font-semibold text-yellow-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> At Risk ({health?.atRisk?.length})
            </h3>
            <div className="space-y-2">
              {health?.atRisk?.slice(0, 5).map((item) => (
                <div key={item.workOrderId} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{item.workOrderNumber}</span>
                    <span className="text-yellow-700 ml-2">{item.title}</span>
                  </div>
                  <span className="text-yellow-800 font-medium">
                    {slaService.formatTimeRemaining(item.remainingMinutes)} left
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SLA Config */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4" /> SLA Configuration
          </h3>
          {configs.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              No SLA policies configured yet
            </div>
          ) : (
            <div className="space-y-2">
              {configs.map((config, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-sm capitalize">{config.priority}</div>
                    <div className="text-xs text-gray-500">
                      Response: {config.responseTimeMinutes}min | Resolution: {config.resolutionTimeMinutes}min
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trends */}
        {(metrics?.trends?.length ?? 0) > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Weekly Trends</h3>
            <div className="space-y-2">
              {metrics?.trends?.map((trend, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{new Date(trend.date).toLocaleDateString()}</span>
                  <div className="flex gap-4">
                    <span className={trend.responseComplianceRate >= 90 ? 'text-green-600' : 'text-red-600'}>
                      Resp: {trend.responseComplianceRate.toFixed(0)}%
                    </span>
                    <span className={trend.resolutionComplianceRate >= 90 ? 'text-green-600' : 'text-red-600'}>
                      Res: {trend.resolutionComplianceRate.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
