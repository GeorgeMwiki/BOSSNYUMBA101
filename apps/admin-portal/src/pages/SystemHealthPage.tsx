/**
 * SystemHealthPage — live operational status of platform services.
 *
 * Assumed backend endpoint:
 *   GET /admin/health/services
 *     -> { data: { services: ServiceHealth[] } }
 *
 * ServiceHealth shape:
 *   { service: string, status: 'healthy'|'degraded'|'down'|'unknown',
 *     lastCheckAt: ISO string, latencyMs: number, version: string }
 *
 * The api client normalizes responses to { success, data, error }.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { api, formatDateTime } from '../lib/api';

type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

interface ServiceHealth {
  service: string;
  status: HealthStatus;
  lastCheckAt: string;
  latencyMs: number;
  version: string;
}

interface HealthResponse {
  services: ServiceHealth[];
}

const REFRESH_INTERVAL_MS = 30_000;

const statusMeta: Record<HealthStatus, { label: string; badge: string; icon: React.ElementType; iconClass: string }> = {
  healthy: { label: 'Healthy', badge: 'bg-green-100 text-green-700', icon: CheckCircle, iconClass: 'text-green-600' },
  degraded: { label: 'Degraded', badge: 'bg-amber-100 text-amber-700', icon: AlertTriangle, iconClass: 'text-amber-600' },
  down: { label: 'Down', badge: 'bg-red-100 text-red-700', icon: XCircle, iconClass: 'text-red-600' },
  unknown: { label: 'Unknown', badge: 'bg-gray-100 text-gray-600', icon: Activity, iconClass: 'text-gray-400' },
};

function resolveStatus(status: string): HealthStatus {
  if (status === 'healthy' || status === 'degraded' || status === 'down') {
    return status;
  }
  return 'unknown';
}

export function SystemHealthPage() {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<HealthResponse>('/admin/health/services')
      .then((res) => {
        if (res.success && res.data) {
          setServices(res.data.services);
          setLastUpdated(new Date());
        } else {
          setError(res.error ?? 'Failed to load system health.');
          setServices([]);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchHealth();
    const t = window.setInterval(fetchHealth, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [fetchHealth]);

  const summary = services.reduce<Record<HealthStatus, number>>(
    (acc, s) => {
      const key = resolveStatus(s.status);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    { healthy: 0, degraded: 0, down: 0, unknown: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-sm text-gray-500 mt-1">
            {lastUpdated
              ? `Last updated ${lastUpdated.toLocaleTimeString()}`
              : 'Fetching latest telemetry...'}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchHealth}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(Object.keys(statusMeta) as HealthStatus[]).map((key) => {
          const meta = statusMeta[key];
          const Icon = meta.icon;
          return (
            <div key={key} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{meta.label}</p>
                <Icon className={`h-5 w-5 ${meta.iconClass}`} />
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">{summary[key]}</p>
            </div>
          );
        })}
      </div>

      {loading && services.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white rounded-xl border border-gray-200">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <p className="text-gray-600">{error}</p>
          <button
            type="button"
            onClick={fetchHealth}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl border border-gray-200">
          <Activity className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">No services reporting yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Service</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Latency</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Version</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {services.map((svc) => {
                const key = resolveStatus(svc.status);
                const meta = statusMeta[key];
                const Icon = meta.icon;
                return (
                  <tr key={svc.service} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{svc.service}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${meta.badge}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {svc.latencyMs.toLocaleString()} ms
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{svc.version}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDateTime(svc.lastCheckAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SystemHealthPage;
