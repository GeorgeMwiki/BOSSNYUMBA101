'use client';

/**
 * <MasteryCheckpoint> — per-phase mastery challenge (gap 10).
 *
 * Backs /coworker/training/checkpoint. Questions are built SERVER-SIDE from
 * the estate concept catalog and returned already ordered weakest-concept
 * first (inverse-BKT). No hints, no reteach. The 0.7 pass threshold (returned
 * by the gateway) gates the next phase: passing unlocks it, missing routes the
 * operator back to the weak concepts.
 *
 * Deterministic + never fabricated: the component renders exactly the
 * questions the gateway returns and submits the per-concept results back so
 * learning_progress (BKT p_know) is updated.
 */

import { useCallback, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Award, ArrowRight, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import {
  trainingScenariosService,
  type CheckpointQuestion,
  type CheckpointSubmitResult,
} from '@bossnyumba/api-client';
import { Button, Progress, Alert, AlertDescription } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import type { TrainingLanguage } from './training-language';

const DEFAULT_PASS_THRESHOLD = 0.7;

interface MasteryCheckpointProps {
  readonly questions: readonly CheckpointQuestion[];
  /** Pass rate in [0, 1]; gateway returns 0.7. */
  readonly passThreshold?: number;
  readonly language: TrainingLanguage;
  /** Fired after results persist; `passed` gates the next phase. */
  readonly onComplete?: (result: CheckpointSubmitResult) => void;
  /** Return to the training hub. */
  readonly onExit: () => void;
}

interface AnswerRecord {
  readonly conceptId: string;
  readonly correct: boolean;
}

export function MasteryCheckpoint({
  questions,
  passThreshold = DEFAULT_PASS_THRESHOLD,
  language,
  onComplete,
  onExit,
}: MasteryCheckpointProps) {
  const t = useTranslations('training');
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [answers, setAnswers] = useState<readonly AnswerRecord[]>([]);

  const submit = useMutation({
    mutationFn: (records: readonly AnswerRecord[]) =>
      trainingScenariosService.submitCheckpoint({
        conceptIds: [...new Set(records.map((r) => r.conceptId))],
        results: records.map((r) => ({ conceptId: r.conceptId, correct: r.correct })),
      }),
    onSuccess: (res) => onComplete?.(res.data),
  });

  const total = questions.length;
  const question = questions[idx];

  const advance = useCallback(() => {
    if (!picked || !question) return;
    const opt = question.options.find((o) => o.id === picked);
    if (!opt) return;
    const next: readonly AnswerRecord[] = [
      ...answers,
      { conceptId: question.conceptId, correct: opt.isCorrect },
    ];
    setAnswers(next);
    setPicked(null);
    if (idx + 1 >= total) {
      submit.mutate(next);
      return;
    }
    setIdx(idx + 1);
  }, [picked, question, answers, idx, total, submit]);

  if (total === 0) {
    return (
      <CheckpointEmpty
        title={t('checkpointEmptyTitle')}
        description={t('checkpointEmptyDesc')}
        exitLabel={t('backToHub')}
        onExit={onExit}
      />
    );
  }

  if (submit.isSuccess && submit.data) {
    const r = submit.data.data;
    return (
      <CheckpointResult
        result={r}
        passThreshold={r.passThreshold ?? passThreshold}
        onExit={onExit}
        onRetry={() => {
          setIdx(0);
          setPicked(null);
          setAnswers([]);
          submit.reset();
        }}
      />
    );
  }

  const progressPct = Math.round((idx / total) * 100);
  const isLast = idx + 1 >= total;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <header className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Award className="h-4 w-4 text-sky-600" aria-hidden="true" />
            {t('checkpointTitle')}
          </span>
          <span className="text-xs tabular-nums text-gray-500">
            {t('questionCounter', { current: idx + 1, total })}
          </span>
        </div>
        <Progress value={progressPct} aria-label={t('checkpointProgress')} />
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t('questionLabel', { n: idx + 1 })}
        </p>
        <h2 className="mb-4 text-lg font-bold leading-snug text-gray-900">
          {question?.prompt}
        </h2>
        <fieldset className="grid gap-2">
          <legend className="sr-only">{question?.prompt}</legend>
          {question?.options.map((opt) => {
            const isSelected = picked === opt.id;
            return (
              <label
                key={opt.id}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm transition-colors ${
                  isSelected
                    ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200'
                    : 'border-gray-200 hover:border-sky-300'
                }`}
              >
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  value={opt.id}
                  checked={isSelected}
                  onChange={() => setPicked(opt.id)}
                  className="h-4 w-4 shrink-0 text-sky-600 focus:ring-sky-500"
                />
                <span className="font-medium text-gray-800">{opt.label}</span>
              </label>
            );
          })}
        </fieldset>
      </section>

      {submit.isError && (
        <Alert variant="warning">
          <AlertDescription>
            {(submit.error as { code?: string })?.code === 'SERVICE_UNAVAILABLE'
              ? t('errorUnavailable')
              : t('checkpointSubmitFailed')}
            <Button
              size="sm"
              variant="outline"
              className="ml-3"
              onClick={() => submit.mutate(answers)}
            >
              {t('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button
          className="min-w-[8rem]"
          disabled={!picked || submit.isPending}
          onClick={advance}
        >
          {submit.isPending ? t('submitting') : isLast ? t('submit') : t('next')}
          {!submit.isPending && <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />}
        </Button>
      </div>

      <p className="text-center text-xs text-gray-400">
        {t('passThresholdNote', { pct: Math.round(passThreshold * 100) })}
      </p>

      {/* `language` reserved for future locale-specific result copy; the
          gateway already localizes question text per the active locale. */}
      <span className="sr-only">{language}</span>
    </div>
  );
}

function CheckpointResult({
  result,
  passThreshold,
  onExit,
  onRetry,
}: {
  readonly result: CheckpointSubmitResult;
  readonly passThreshold: number;
  readonly onExit: () => void;
  readonly onRetry: () => void;
}) {
  const t = useTranslations('training');
  const pct = Math.round(result.score * 100);
  return (
    <div
      className="mx-auto flex max-w-2xl flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-12 text-center"
      data-testid="checkpoint-result"
    >
      <div
        className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
          result.passed ? 'bg-green-100' : 'bg-amber-100'
        }`}
      >
        {result.passed ? (
          <CheckCircle2 className="h-8 w-8 text-green-600" aria-hidden="true" />
        ) : (
          <XCircle className="h-8 w-8 text-amber-600" aria-hidden="true" />
        )}
      </div>
      <h2 className="text-xl font-bold text-gray-900">
        {result.passed ? t('phaseMasteredTitle') : t('phaseMissedTitle')}
      </h2>
      <p className="mt-1.5 text-sm text-gray-600">
        {t('checkpointScoreLine', { correct: result.correct, total: result.total, pct })}
      </p>
      <p className="mt-1 text-xs text-gray-400">
        {result.passed
          ? t('phaseUnlockedNote')
          : t('phaseLockedNote', { pct: Math.round(passThreshold * 100) })}
      </p>

      {result.weakConceptIds.length > 0 && !result.passed && (
        <div className="mt-5 w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
          <p className="mb-1.5 text-xs font-semibold text-amber-900">{t('reviewTheseTitle')}</p>
          <ul className="flex flex-wrap gap-1.5" role="list">
            {result.weakConceptIds.map((id) => (
              <li
                key={id}
                className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-xs text-amber-800"
              >
                {id}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        {!result.passed && (
          <Button variant="outline" onClick={onRetry}>
            <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t('retakeCheckpoint')}
          </Button>
        )}
        <Button onClick={onExit}>
          {t('backToHub')}
          <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function CheckpointEmpty({
  title,
  description,
  exitLabel,
  onExit,
}: {
  readonly title: string;
  readonly description: string;
  readonly exitLabel: string;
  readonly onExit: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
      <Award className="mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-gray-600">{description}</p>
      <Button className="mt-6" variant="outline" onClick={onExit}>
        {exitLabel}
      </Button>
    </div>
  );
}
