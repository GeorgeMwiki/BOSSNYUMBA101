import React, { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Alert,
  AlertDescription,
  Skeleton,
} from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { api } from '../../lib/api';

export interface GamificationConfig {
  readonly enabled: boolean;
  readonly onTimeRentPoints: number;
  readonly referralPoints: number;
  readonly reviewPoints: number;
}

export interface GamificationStats {
  readonly activeParticipants: number;
  readonly totalPointsIssued: number;
  readonly topTenants: ReadonlyArray<{ readonly tenantId: string; readonly name: string; readonly points: number }>;
}

export const GamificationDashboard: React.FC = () => {
  const t = useTranslations('gamification');
  const [config, setConfig] = useState<GamificationConfig | null>(null);
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<boolean>(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: wire GET /owner/gamification/config and /stats
      const [cfg, st] = await Promise.all([
        api.get?.<GamificationConfig>('/owner/gamification/config'),
        api.get?.<GamificationStats>('/owner/gamification/stats'),
      ]);
      if (!signal?.aborted) {
        setConfig(cfg?.data ?? null);
        setStats(st?.data ?? null);
        setLoading(false);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setError(err instanceof Error ? err.message : t('failedToLoad'));
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const toggle = useCallback(async (): Promise<void> => {
    if (!config) return;
    setToggling(true);
    setError(null);
    const prev = config;
    const next: GamificationConfig = { ...config, enabled: !config.enabled }; // immutable
    setConfig(next); // optimistic
    try {
      // TODO: wire PUT /owner/gamification/config
      // patch is used because the current api client does not expose put().
      await api.patch('/owner/gamification/config', next);
    } catch (err) {
      // Roll back on failure.
      setConfig(prev);
      setError(err instanceof Error ? err.message : t('failedToUpdate'));
    } finally {
      setToggling(false);
    }
  }, [config]);

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      {error && (
        <Alert variant="danger">
          <AlertDescription>
            {error}
            <Button variant="link" size="sm" onClick={() => void load()} className="ml-2">
              {t('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('configuration')}</CardTitle>
            <Button
              onClick={toggle}
              variant={config?.enabled ? 'destructive' : 'primary'}
              loading={toggling}
              disabled={!config || toggling}
              aria-label={config?.enabled ? t('disableAria') : t('enableAria')}
            >
              {config?.enabled ? t('disable') : t('enable')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2" aria-live="polite">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-36" />
            </div>
          ) : config ? (
            <ul className="text-sm space-y-1">
              <li>{t('onTimeRent', { points: config.onTimeRentPoints })}</li>
              <li>{t('referral', { points: config.referralPoints })}</li>
              <li>{t('review', { points: config.reviewPoints })}</li>
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noConfig')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('aggregateStats')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3" aria-live="polite">
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">{t('activeParticipants')}</p>
                  <p className="text-2xl font-semibold">{stats.activeParticipants}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('totalPointsIssued')}</p>
                  <p className="text-2xl font-semibold">{stats.totalPointsIssued.toLocaleString()}</p>
                </div>
              </div>
              <h4 className="text-sm font-medium mb-2">{t('topTenants')}</h4>
              {stats.topTenants.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noParticipants')}</p>
              ) : (
                <ul className="text-sm">
                  {stats.topTenants.map((tenant) => (
                    <li key={tenant.tenantId} className="flex justify-between py-1">
                      <span>{tenant.name}</span>
                      <Badge>{t('pointsAbbrev', { points: tenant.points })}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noStats')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GamificationDashboard;
