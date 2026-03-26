'use client';

import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface LiveDataRequiredScreenProps {
  title: string;
  feature: string;
  description?: string;
  showBack?: boolean;
  showSettings?: boolean;
}

interface LiveDataRequiredPanelProps {
  title: string;
  message: string;
}

export function LiveDataRequiredScreen({
  title,
  feature,
  description,
  showBack = false,
  showSettings = false,
}: LiveDataRequiredScreenProps) {
  return (
    <>
      <PageHeader title={title} showBack={showBack} showSettings={showSettings} />

      <div className="space-y-4 px-4 py-4">
        <div className="card border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white">{feature} unavailable</h2>
              <p className="text-sm text-red-100">
                {description ??
                  `${feature} data is not yet available. Please check back once the service has been configured.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function LiveDataRequiredPanel({
  title,
  message,
}: LiveDataRequiredPanelProps) {
  return (
    <div className="card border-red-500/30 bg-red-500/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
        <div className="space-y-1">
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-sm text-red-100">{message}</p>
        </div>
      </div>
    </div>
  );
}
