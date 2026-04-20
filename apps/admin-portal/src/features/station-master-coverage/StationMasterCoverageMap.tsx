import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Alert,
  AlertDescription,
  Skeleton,
  EmptyState,
} from '@bossnyumba/design-system';
import { api } from '../../lib/api';

export interface StationMasterCoverage {
  readonly masterId: string;
  readonly name: string;
  readonly regions: ReadonlyArray<{ readonly id: string; readonly name: string; readonly propertyCount: number }>;
  readonly status: 'active' | 'on_leave' | 'unavailable';
}

interface StationMasterCoverageMapProps {
  readonly onReassign?: () => void;
}

export const StationMasterCoverageMap: React.FC<StationMasterCoverageMapProps> = ({ onReassign }) => {
  const t = useTranslations('stationMasterCoverageMap');
  const [coverage, setCoverage] = useState<ReadonlyArray<StationMasterCoverage>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: wire GET /admin/station-masters/coverage endpoint.
      const res = await api.get?.<ReadonlyArray<StationMasterCoverage>>(
        '/admin/station-masters/coverage'
      );
      if (!signal?.aborted) {
        setCoverage(res?.data ?? []);
        setLoading(false);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setError(err instanceof Error ? err.message : t('errors.loadFailed'));
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const reassignDisabled = typeof onReassign !== 'function';

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button
          variant="outline"
          onClick={onReassign}
          disabled={reassignDisabled}
          title={reassignDisabled ? t('reassignUnavailable') : undefined}
          aria-label={t('reassignAria')}
        >
          {t('reassignRegions')}
        </Button>
      </div>

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

      {/* TODO: Replace placeholder with Mapbox/Leaflet heatmap of region coverage. */}
      <Card>
        <CardHeader>
          <CardTitle>{t('coverageMap')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="h-64 flex items-center justify-center bg-muted rounded-md text-sm text-muted-foreground"
            role="img"
            aria-label={t('mapPlaceholderAria')}
          >
            {t('mapPlaceholder')}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2" aria-live="polite">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : coverage.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {coverage.map((m) => (
            <Card key={m.masterId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{m.name}</CardTitle>
                  <Badge>{m.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {m.regions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('noRegions')}</p>
                ) : (
                  <ul className="text-sm">
                    {m.regions.map((r) => (
                      <li key={r.id} className="flex justify-between">
                        <span>{r.name}</span>
                        <span className="text-muted-foreground">{t('propsCount', { count: r.propertyCount })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StationMasterCoverageMap;
