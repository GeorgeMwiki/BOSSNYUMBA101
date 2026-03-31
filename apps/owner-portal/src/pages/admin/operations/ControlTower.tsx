import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useSystemHealth } from '../../../lib/hooks';

export default function ControlTower() {
  const { isLoading, error } = useSystemHealth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Operations Control Tower</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cross-tenant monitoring requires live telemetry and workflow streams.
        </p>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Live operations data unavailable</p>
            <p className="text-sm text-red-700 mt-1">
              {error instanceof Error
                ? error.message
                : 'Operations monitoring data is not yet available. Please check back once the service has been configured.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
