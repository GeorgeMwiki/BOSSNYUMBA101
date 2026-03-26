import React, { useState, useEffect } from 'react';
import {
  Server,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Activity,
  Database,
  Cpu,
  HardDrive,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime?: string;
}

interface SystemHealthData {
  overallStatus: string;
  services: ServiceStatus[];
  notifications: Array<{
    id: string;
    title?: string;
    message?: string;
    createdAt?: string;
  }>;
}

const serviceIcons: Record<string, React.ElementType> = {
  'API Gateway': Server,
  'Auth Service': Cpu,
  'Database Primary': Database,
  'Object Storage': HardDrive,
};

const statusConfig: Record<string, { bg: string; iconColor: string; label: string; Icon: React.ElementType }> = {
  healthy: { bg: 'bg-green-100', iconColor: 'text-green-600', label: 'Healthy', Icon: CheckCircle },
  degraded: { bg: 'bg-amber-100', iconColor: 'text-amber-600', label: 'Degraded', Icon: AlertTriangle },
  down: { bg: 'bg-red-100', iconColor: 'text-red-600', label: 'Down', Icon: XCircle },
};

export function SystemHealthPage() {
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<SystemHealthData>('/system/health');
    if (res.success && res.data) {
      setHealthData(res.data);
    } else {
      setError(res.error || 'Failed to load system health data');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="space-y-2">
          <div className="h-7 bg-gray-200 rounded w-36" />
          <div className="h-4 bg-gray-200 rounded w-64" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 bg-gray-200 rounded-full" />
            <div className="space-y-1">
              <div className="h-5 bg-gray-200 rounded w-40" />
              <div className="h-3 bg-gray-200 rounded w-36" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 bg-gray-200 rounded-lg" />
                <div className="h-4 bg-gray-200 rounded w-14" />
              </div>
              <div className="h-4 bg-gray-200 rounded w-28" />
              <div className="h-3 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="h-5 bg-gray-200 rounded w-48" />
          </div>
          {[1,2,3,4].map(i => (
            <div key={i} className="p-4 border-b border-gray-100 flex items-start gap-3">
              <div className="h-5 w-5 bg-gray-200 rounded" />
              <div className="flex-1 space-y-1">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <div className="p-4 bg-amber-50 rounded-full mb-4">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">System Health Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">{error}</p>
        <button
          onClick={fetchHealth}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  const services = healthData?.services ?? [];
  const notifList = healthData?.notifications ?? [];
  const overallStatus = healthData?.overallStatus ?? 'unknown';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
        <p className="text-sm text-gray-500 mt-1">Infrastructure telemetry and service monitoring</p>
      </div>

      {/* Overall Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3">
          {overallStatus === 'healthy' ? (
            <CheckCircle className="h-6 w-6 text-green-600" />
          ) : overallStatus === 'degraded' ? (
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          ) : (
            <XCircle className="h-6 w-6 text-red-600" />
          )}
          <div>
            <h3 className="font-semibold text-gray-900">
              {overallStatus === 'healthy' ? 'All Systems Operational' : overallStatus === 'degraded' ? 'Some Systems Degraded' : 'System Issues Detected'}
            </h3>
            <p className="text-sm text-gray-500">Connected to live monitoring</p>
          </div>
        </div>
      </div>

      {/* Service Grid */}
      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Server className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-base font-semibold text-gray-900 mb-1">No Services Found</h3>
          <p className="text-sm text-gray-500">No service status data is available at this time.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {services.map((svc) => {
          const SvcIcon = serviceIcons[svc.name] || Server;
          const svcStatus = statusConfig[svc.status] || statusConfig.healthy;
          const StatusIcon = svcStatus.Icon;
          return (
            <div key={svc.name} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 ${svcStatus.bg} rounded-lg`}>
                  <SvcIcon className={`h-5 w-5 ${svcStatus.iconColor}`} />
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${svcStatus.iconColor}`}>
                  <StatusIcon className="h-3 w-3" />
                  {svcStatus.label}
                </span>
              </div>
              <h4 className="font-medium text-gray-900">{svc.name}</h4>
              <p className="text-xs text-gray-500 mt-1">Uptime: {svc.uptime || 'N/A'}</p>
            </div>
          );
        })}
      </div>
      )}

      {/* Recent Alerts */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Recent System Notifications</h3>
        </div>
        {notifList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-3 bg-green-100 rounded-full mb-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No Recent Alerts</h3>
            <p className="text-sm text-gray-500 max-w-sm">All systems are running smoothly with no recent notifications.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {notifList.slice(0, 10).map((n: any) => (
              <div key={n.id} className="p-4 hover:bg-gray-50 flex items-start gap-3">
                <Activity className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{n.title || n.message || 'Alert'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : '-'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
