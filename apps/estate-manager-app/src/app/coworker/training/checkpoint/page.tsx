'use client';

/**
 * /coworker/training/checkpoint — mastery-checkpoint surface (gap 10).
 *
 * Fetches a checkpoint built SERVER-SIDE from the estate concept catalog and
 * ordered weakest-concept-first (inverse-BKT) via the gateway
 * /api/v1/scenarios/checkpoint route. The 0.7 pass threshold (returned by the
 * gateway) gates the next phase. An optional `?kind=<scenarioKind>` scopes the
 * checkpoint to one phase's concepts.
 *
 * HONEST-DEGRADE: questions are deterministic and never fabricated. A 503
 * (thrown) shows a graceful "service unavailable"; a 200 with `degraded: true`
 * (no catalog concept resolved) shows an empty state.
 */

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ServerCrash } from 'lucide-react';
import { trainingScenariosService } from '@bossnyumba/api-client';
import { Alert, AlertDescription, Button, Skeleton } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { MasteryCheckpoint, TrainingNav, toTrainingLanguage } from '@/features/training';

export default function MasteryCheckpointPage() {
  const t = useTranslations('training');
  const router = useRouter();
  const locale = useLocale();
  const language = toTrainingLanguage(locale);
  const searchParams = useSearchParams();
  const kind = searchParams?.get('kind') ?? undefined;

  const checkpointQuery = useQuery({
    queryKey: ['training-checkpoint', language, kind ?? 'all'],
    queryFn: () =>
      trainingScenariosService.checkpoint(kind ? { language, kind } : { language }),
    retry: false,
  });

  const data = checkpointQuery.data?.data;
  const questions = useMemo(() => data?.questions ?? [], [data]);
  const passThreshold = data?.passThreshold ?? 0.7;

  const goToHub = () => router.push('/coworker/training');

  return (
    <>
      <PageHeader title={t('checkpointPageTitle')} subtitle={t('checkpointPageSubtitle')} showBack />

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-4">
        <TrainingNav />

        {checkpointQuery.isLoading && <CheckpointSkeleton />}

        {checkpointQuery.isError && (
          <Alert variant="warning" icon={<ServerCrash className="h-5 w-5" aria-hidden="true" />}>
            <AlertDescription>
              {(checkpointQuery.error as { code?: string })?.code === 'SERVICE_UNAVAILABLE'
                ? t('errorUnavailable')
                : t('errorLoad')}
              <Button
                size="sm"
                variant="outline"
                className="ml-3"
                onClick={() => void checkpointQuery.refetch()}
              >
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!checkpointQuery.isLoading && !checkpointQuery.isError && (
          <MasteryCheckpoint
            questions={questions}
            passThreshold={passThreshold}
            language={language}
            onExit={goToHub}
          />
        )}
      </div>
    </>
  );
}

function CheckpointSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-5" aria-busy="true">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
