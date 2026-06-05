'use client';

/**
 * <ScenarioWorkspace> — one interactive rehearsal run.
 *
 * Backs /coworker/training/scenarios (gap 9) once a scenario is chosen. Three
 * phases driven by the training-mode context:
 *   1. briefing  — counterparty + situation + objectives (grounded, read-only)
 *   2. active    — messaging transcript; each learner turn returns a grounded
 *                  counterparty reply + objective-coverage; a decision-capture
 *                  timer runs throughout
 *   3. complete  — score + pass/fail, scored from coverage + timing
 *
 * The counterparty reply is produced server-side from the scenario briefing
 * (never free-hand). Errors (incl. 503 / 403 role-mode) surface inline.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock,
  Send,
  Target,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Flag,
  ShieldCheck,
} from 'lucide-react';
import type { ScenarioView, ScenarioRoleMode } from '@bossnyumba/api-client';
import { Button, Badge, Progress, Alert, AlertDescription, Spinner } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { useTraining } from './training-mode-context';
import {
  computeRunScore,
  formatElapsed,
  kindLabelKey,
  roleModeLabelKey,
  type TrainingLanguage,
} from './training-language';

interface ScenarioWorkspaceProps {
  readonly scenario: ScenarioView;
  readonly roleMode: ScenarioRoleMode | null;
  readonly language: TrainingLanguage;
  readonly onExit: () => void;
}

export function ScenarioWorkspace({
  scenario,
  roleMode,
  language,
  onExit,
}: ScenarioWorkspaceProps) {
  const t = useTranslations('training');
  const { state, start, send, complete } = useTraining();
  const [input, setInput] = useState('');
  const startedRef = useRef(false);

  // Begin the run once on mount (role-mode validated server-side).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start(scenario, roleMode);
  }, [scenario, roleMode, start]);

  const title = language === 'sw' && scenario.titleSw ? scenario.titleSw : scenario.title;
  const briefing = scenario.briefing;
  const objectivesTotal = state.objectivesTotal || (briefing.objectives?.length ?? 0);
  const coveragePct =
    objectivesTotal > 0 ? Math.round((state.objectivesCovered / objectivesTotal) * 100) : 0;
  const allCovered = objectivesTotal > 0 && state.objectivesCovered >= objectivesTotal;

  const handleSend = () => {
    const text = input.trim();
    if (!text || state.isSending) return;
    setInput('');
    void send(text);
  };

  const handleComplete = () => {
    const score = computeRunScore(
      state.objectivesCovered,
      objectivesTotal,
      state.elapsedMs,
      scenario.estimatedMinutes,
    );
    void complete(score);
  };

  // Role-mode lock rejected by the server — surface a clear, recoverable state.
  if (state.errorCode === 'FORBIDDEN_ROLE_MODE') {
    return (
      <WorkspaceError
        title={t('roleModeRejectedTitle')}
        message={state.error ?? t('roleModeRejectedDesc')}
        onExit={onExit}
        exitLabel={t('backToBrowser')}
      />
    );
  }
  if (state.errorCode === 'SERVICE_UNAVAILABLE') {
    return (
      <WorkspaceError
        title={t('errorUnavailable')}
        message={t('errorUnavailableDesc')}
        onExit={onExit}
        exitLabel={t('backToBrowser')}
      />
    );
  }

  if (state.phase === 'complete') {
    return (
      <RunResult
        passed={state.passed ?? false}
        score={state.score ?? 0}
        objectivesCovered={state.objectivesCovered}
        objectivesTotal={objectivesTotal}
        onExit={onExit}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onExit} aria-label={t('backToBrowser')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500">{t(kindLabelKey(scenario.kind))}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {state.roleMode && (
            <Badge variant="info-soft" size="sm">
              <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />
              {t(roleModeLabelKey(state.roleMode))}
            </Badge>
          )}
          <div
            className="flex items-center gap-1.5 text-sm text-gray-700"
            aria-label={t('elapsedTime')}
          >
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span className="font-mono tabular-nums">{formatElapsed(state.elapsedMs)}</span>
            <span className="text-xs text-gray-400">
              / {scenario.estimatedMinutes}:00
            </span>
          </div>
        </div>
      </header>

      {objectivesTotal > 0 && (
        <section
          aria-label={t('objectiveCoverage')}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="mb-2 flex items-center justify-between text-xs text-gray-600">
            <span className="flex items-center gap-1.5 font-medium">
              <Target className="h-3.5 w-3.5" aria-hidden="true" />
              {t('objectiveCoverage')}
            </span>
            <span className="tabular-nums">
              {t('coverageValue', {
                covered: state.objectivesCovered,
                total: objectivesTotal,
              })}
            </span>
          </div>
          <Progress value={coveragePct} aria-label={t('objectiveCoverage')} />
        </section>
      )}

      {state.isStarting ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
          <Spinner size="sm" />
          {t('startingRun')}
        </div>
      ) : (
        <Briefing scenario={scenario} language={language} />
      )}

      {state.phase === 'active' && (
        <Transcript scenario={scenario} language={language} />
      )}

      {state.error && state.errorCode !== 'FORBIDDEN_ROLE_MODE' && (
        <Alert variant="warning">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state.phase === 'active' && (
        <Composer
          input={input}
          disabled={state.isSending}
          onChange={setInput}
          onSend={handleSend}
          onComplete={handleComplete}
          canComplete={state.transcript.length > 0}
          highlightComplete={allCovered}
        />
      )}
    </div>
  );
}

function Briefing({
  scenario,
  language,
}: {
  readonly scenario: ScenarioView;
  readonly language: TrainingLanguage;
}) {
  const t = useTranslations('training');
  const b = scenario.briefing;
  const counterparty =
    language === 'sw' ? b.counterpartySw ?? b.counterpartyEn : b.counterpartyEn;
  const situation = language === 'sw' ? b.situationSw ?? b.situationEn : b.situationEn;
  const objectives = b.objectives ?? [];

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">{t('briefingTitle')}</h3>
      {counterparty && (
        <p className="mt-2 text-sm text-gray-700">
          <span className="font-medium text-gray-900">{t('counterparty')}: </span>
          {counterparty}
        </p>
      )}
      {situation && <p className="mt-2 text-sm text-gray-600">{situation}</p>}
      {objectives.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
            {t('objectivesLabel')}
          </p>
          <ul className="space-y-1.5" role="list">
            {objectives.map((o) => (
              <li key={o.conceptId} className="flex items-start gap-2 text-sm text-gray-700">
                <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" aria-hidden="true" />
                <span>{language === 'sw' ? o.sw : o.en}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Transcript({
  scenario,
  language,
}: {
  readonly scenario: ScenarioView;
  readonly language: TrainingLanguage;
}) {
  const t = useTranslations('training');
  const { state } = useTraining();
  const scrollRef = useRef<HTMLDivElement>(null);
  const counterpartyName = useMemo(() => {
    const b = scenario.briefing;
    return language === 'sw' ? b.counterpartySw ?? b.counterpartyEn : b.counterpartyEn;
  }, [scenario.briefing, language]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.transcript, state.isSending]);

  return (
    <div
      ref={scrollRef}
      className="flex max-h-[24rem] flex-col gap-3 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4"
      role="log"
      aria-label={t('transcript')}
      aria-live="polite"
    >
      {state.transcript.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-400">{t('transcriptEmpty')}</p>
      )}
      {state.transcript.map((turn) => (
        <div key={turn.id} className="flex flex-col gap-2">
          <div className="self-end max-w-[85%] rounded-2xl rounded-br-sm bg-sky-500 px-3 py-2 text-sm text-white">
            {turn.learner}
          </div>
          {turn.reply && (
            <div className="self-start max-w-[85%]">
              <p className="mb-0.5 pl-1 text-[11px] text-gray-500">{counterpartyName}</p>
              <div className="rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900">
                {language === 'sw' ? turn.reply.sw : turn.reply.en}
              </div>
            </div>
          )}
        </div>
      ))}
      {state.isSending && (
        <div className="flex items-center gap-2 pl-1 text-xs text-gray-500">
          <Spinner size="sm" />
          {t('counterpartyTyping')}
        </div>
      )}
    </div>
  );
}

interface ComposerProps {
  readonly input: string;
  readonly disabled: boolean;
  readonly onChange: (v: string) => void;
  readonly onSend: () => void;
  readonly onComplete: () => void;
  readonly canComplete: boolean;
  readonly highlightComplete: boolean;
}

function Composer({
  input,
  disabled,
  onChange,
  onSend,
  onComplete,
  canComplete,
  highlightComplete,
}: ComposerProps) {
  const t = useTranslations('training');
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <label htmlFor="scenario-input" className="sr-only">
        {t('inputLabel')}
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id="scenario-input"
          value={input}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={2}
          placeholder={t('inputPlaceholder')}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <Button onClick={onSend} disabled={disabled || !input.trim()}>
          <Send className="h-4 w-4" aria-hidden="true" />
          <span className="ml-1.5">{t('send')}</span>
        </Button>
      </div>
      <div className="mt-2 flex justify-end">
        <Button
          variant={highlightComplete ? 'default' : 'outline'}
          size="sm"
          onClick={onComplete}
          disabled={!canComplete}
        >
          <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {t('completeRun')}
        </Button>
      </div>
    </div>
  );
}

function RunResult({
  passed,
  score,
  objectivesCovered,
  objectivesTotal,
  onExit,
}: {
  readonly passed: boolean;
  readonly score: number;
  readonly objectivesCovered: number;
  readonly objectivesTotal: number;
  readonly onExit: () => void;
}) {
  const t = useTranslations('training');
  const pct = Math.round(score * 100);
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-12 text-center"
      data-testid="scenario-result"
    >
      <div
        className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
          passed ? 'bg-green-100' : 'bg-amber-100'
        }`}
      >
        {passed ? (
          <CheckCircle2 className="h-8 w-8 text-green-600" aria-hidden="true" />
        ) : (
          <XCircle className="h-8 w-8 text-amber-600" aria-hidden="true" />
        )}
      </div>
      <h2 className="text-xl font-bold text-gray-900">
        {passed ? t('runPassedTitle') : t('runMissedTitle')}
      </h2>
      <p className="mt-1.5 text-sm text-gray-600">
        {t('runScoreLine', { pct, covered: objectivesCovered, total: objectivesTotal })}
      </p>
      <Button className="mt-6" onClick={onExit}>
        {t('backToBrowser')}
      </Button>
    </div>
  );
}

function WorkspaceError({
  title,
  message,
  onExit,
  exitLabel,
}: {
  readonly title: string;
  readonly message: string;
  readonly onExit: () => void;
  readonly exitLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-6 py-12 text-center">
      <XCircle className="mb-3 h-10 w-10 text-amber-500" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-gray-600">{message}</p>
      <Button className="mt-6" variant="outline" onClick={onExit}>
        {exitLabel}
      </Button>
    </div>
  );
}
