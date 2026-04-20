'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { useTranslations } from 'next-intl';

interface ConditionalSurvey {
  readonly id: string;
  readonly unitLabel: string;
  readonly triggeredBy: string;
  readonly severityEstimate: 'minor' | 'moderate' | 'major';
  readonly status: 'draft' | 'submitted' | 'approved' | 'rejected';
}

export default function ConditionalSurveysPage(): React.ReactElement {
  const t = useTranslations('conditionalSurveys');
  const router = useRouter();
  const [surveys, setSurveys] = useState<ReadonlyArray<ConditionalSurvey>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: wire /api/inspections/conditional-surveys
      const res = await fetch('/api/inspections/conditional-surveys', { signal });
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const data = (await res.json()) as ReadonlyArray<ConditionalSurvey>;
      if (!signal?.aborted) {
        setSurveys(data);
        setLoading(false);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : t('failedLoad'));
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const handleNewSurvey = useCallback(() => {
    router.push('/inspections/conditional-surveys/new');
  }, [router]);

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button onClick={handleNewSurvey} aria-label={t('newSurveyAria')}>
          {t('newSurvey')}
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

      {loading ? (
        <div className="grid gap-3" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : surveys.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDesc')}
          action={
            <Button onClick={handleNewSurvey} aria-label={t('newSurveyAria')}>
              {t('newSurvey')}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {surveys.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{s.unitLabel}</CardTitle>
                  <Badge>{s.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{t('triggerLabel', { triggeredBy: s.triggeredBy })}</p>
                <p className="text-sm">{t('severityLabel', { severity: s.severityEstimate })}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
