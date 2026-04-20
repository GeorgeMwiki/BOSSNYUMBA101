import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Skeleton, Alert, AlertDescription } from '@bossnyumba/design-system';
import { useSystemHealth } from '../../lib/hooks';

export default function ControlTower() {
  const t = useTranslations('controlTower');
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
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('subtitle')}
        </p>
      </div>

      <Alert variant="danger" title={t('unavailableTitle')}>
        <AlertDescription>
          {error instanceof Error
            ? error.message
            : t('unavailableBody')}
        </AlertDescription>
      </Alert>
    </div>
  );
}
