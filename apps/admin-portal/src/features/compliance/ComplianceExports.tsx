import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  EmptyState,
} from '@bossnyumba/design-system';
import { api } from '../../lib/api';

export interface ComplianceExport {
  readonly id: string;
  readonly type: 'kra_itax' | 'nssf' | 'nhif' | 'gepg' | 'audit_log';
  readonly period: string; // e.g. '2026-03'
  readonly status: 'queued' | 'generating' | 'ready' | 'failed';
  readonly downloadUrl?: string;
  readonly createdAt: string;
}

export const ComplianceExports: React.FC = () => {
  const t = useTranslations('complianceExports');
  const [exports, setExports] = useState<ReadonlyArray<ComplianceExport>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [schedulingType, setSchedulingType] = useState<ComplianceExport['type'] | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const loadExports = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      // TODO: wire GET /admin/compliance/exports endpoint.
      const res = await api.get?.<ReadonlyArray<ComplianceExport>>('/admin/compliance/exports');
      if (!signal?.aborted) {
        setExports(res?.data ?? []);
        setLoading(false);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setLoadError(err instanceof Error ? err.message : t('errors.loadFailed'));
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    const ctrl = new AbortController();
    void loadExports(ctrl.signal);
    return () => ctrl.abort();
  }, [loadExports]);

  const scheduleExport = useCallback(async (type: ComplianceExport['type']): Promise<void> => {
    setSchedulingType(type);
    setFeedback(null);
    try {
      // TODO: wire POST /admin/compliance/exports { type, period } endpoint.
      await api.post?.('/admin/compliance/exports', { type });
      setFeedback({ kind: 'success', message: t('exportQueued', { type: type.toUpperCase() }) });
      // Refresh list immutably.
      await loadExports();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.scheduleFailed');
      setFeedback({ kind: 'error', message });
    } finally {
      setSchedulingType(null);
    }
  }, [loadExports, t]);

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      {feedback && (
        <Alert variant={feedback.kind === 'success' ? 'success' : 'danger'}>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('scheduleNew')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            onClick={() => scheduleExport('kra_itax')}
            loading={schedulingType === 'kra_itax'}
            disabled={schedulingType !== null}
          >
            KRA iTax
          </Button>
          <Button
            onClick={() => scheduleExport('nssf')}
            loading={schedulingType === 'nssf'}
            disabled={schedulingType !== null}
          >
            NSSF
          </Button>
          <Button
            onClick={() => scheduleExport('nhif')}
            loading={schedulingType === 'nhif'}
            disabled={schedulingType !== null}
          >
            NHIF
          </Button>
          <Button
            onClick={() => scheduleExport('gepg')}
            loading={schedulingType === 'gepg'}
            disabled={schedulingType !== null}
          >
            GePG
          </Button>
          <Button
            variant="outline"
            onClick={() => scheduleExport('audit_log')}
            loading={schedulingType === 'audit_log'}
            disabled={schedulingType !== null}
          >
            Audit log
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('recentExports')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2" aria-live="polite">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : loadError ? (
            <Alert variant="danger">
              <AlertDescription>
                {loadError}
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => void loadExports()}
                  className="ml-2"
                >
                  {t('retry')}
                </Button>
              </AlertDescription>
            </Alert>
          ) : exports.length === 0 ? (
            <EmptyState
              title={t('emptyTitle')}
              description={t('emptyDescription')}
            />
          ) : (
            <ul className="divide-y">
              {exports.map((e) => (
                <li key={e.id} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{e.type.toUpperCase()} — {e.period}</p>
                    <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{e.status}</Badge>
                    {e.status === 'ready' && e.downloadUrl && (
                      <a href={e.downloadUrl} download aria-label={t('downloadAria', { type: e.type, period: e.period })}>
                        <Button size="sm">{t('download')}</Button>
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ComplianceExports;
