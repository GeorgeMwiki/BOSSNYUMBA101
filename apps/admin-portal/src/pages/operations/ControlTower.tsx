import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Skeleton, Alert, AlertDescription } from '@bossnyumba/design-system';
import { useSystemHealth } from '../../lib/hooks';

export default function ControlTower() {
  const { isLoading, error } = useSystemHealth();

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
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

      <Alert variant="danger" title="Live operations data unavailable">
        <AlertDescription>
          {error instanceof Error
            ? error.message
            : 'This control tower is disabled until production monitoring feeds are connected.'}
        </AlertDescription>
      </Alert>
    </div>
  );
}
