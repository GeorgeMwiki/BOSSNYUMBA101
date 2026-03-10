'use client';

import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface LiveDataRequiredPageProps {
  title: string;
  feature: string;
  description?: string;
  showBack?: boolean;
}

export function LiveDataRequiredPage({
  title,
  feature,
  description,
  showBack = false,
}: LiveDataRequiredPageProps) {
  return (
    <>
      <PageHeader title={title} showBack={showBack} />

      <div className="space-y-4 px-4 py-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-red-900">{feature} unavailable</h2>
              <p className="text-sm text-red-800">
                {description ??
                  `This screen is unavailable until live ${feature.toLowerCase()} is wired.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
