'use client';

/**
 * <ScenarioBrowser> — filterable catalog of estate rehearsal scenarios.
 *
 * Backs /coworker/training/scenarios (gap 9). Fetches the tenant's active
 * scenario templates from the gateway via the api-client, lets the operator
 * filter by difficulty / kind / competency (concept), and hands a chosen
 * scenario up to the workspace.
 *
 * HONEST-DEGRADE: scenario content is NEVER fabricated. A 503 surfaces as a
 * thrown ApiClientError (graceful "service unavailable"); a 200 with
 * `degraded: true` (no catalog concept resolved) surfaces as an empty state
 * with a "generate from catalog" action that re-fetches.
 */

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Target,
  Play,
  Filter,
  GraduationCap,
  ServerCrash,
  Sparkles,
} from 'lucide-react';
import {
  trainingScenariosService,
  type ScenarioView,
  type ScenarioDifficulty,
} from '@bossnyumba/api-client';
import {
  Card,
  Badge,
  Button,
  Empty,
  Alert,
  AlertDescription,
  Skeleton,
} from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import {
  difficultyTone,
  kindLabelKey,
  SCENARIO_DIFFICULTIES,
  SCENARIO_KINDS,
  type TrainingLanguage,
} from './training-language';

interface ScenarioBrowserProps {
  readonly language: TrainingLanguage;
  readonly onSelect: (scenario: ScenarioView) => void;
  /**
   * Admin deep-link role-mode lock, surfaced as a banner. `null` when no
   * role-mode was deep-linked (kept non-optional so it stays
   * exactOptionalPropertyTypes-safe at the call site).
   */
  readonly lockedRoleModeLabel: string | null;
}

type DifficultyFilter = 'all' | ScenarioDifficulty;
type KindFilter = 'all' | string;
type ConceptFilter = 'all' | string;

export function ScenarioBrowser({
  language,
  onSelect,
  lockedRoleModeLabel,
}: ScenarioBrowserProps) {
  const t = useTranslations('training');
  const queryClient = useQueryClient();
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const [kind, setKind] = useState<KindFilter>('all');
  const [concept, setConcept] = useState<ConceptFilter>('all');

  const listQuery = useQuery({
    queryKey: ['training-scenarios', language],
    queryFn: () => trainingScenariosService.list(language),
    retry: false,
  });

  const generate = useMutation({
    mutationFn: () => trainingScenariosService.generate({ language }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['training-scenarios', language] });
    },
  });

  const scenarios = useMemo<readonly ScenarioView[]>(
    () => listQuery.data?.data?.data ?? [],
    [listQuery.data],
  );
  const degraded = listQuery.data?.data?.degraded ?? false;

  // Concept pool for the competency filter — the union of every scenario's
  // grounded concept ids (real, never invented).
  const conceptIds = useMemo(() => {
    const set = new Set<string>();
    for (const s of scenarios) for (const id of s.conceptIds) set.add(id);
    return [...set].sort();
  }, [scenarios]);

  const filtered = useMemo(
    () =>
      scenarios.filter((s) => {
        if (difficulty !== 'all' && s.difficulty !== difficulty) return false;
        if (kind !== 'all' && s.kind !== kind) return false;
        if (concept !== 'all' && !s.conceptIds.includes(concept)) return false;
        return true;
      }),
    [scenarios, difficulty, kind, concept],
  );

  if (listQuery.isLoading) {
    return <BrowserSkeleton />;
  }

  // 503 / network: the gateway honest-degrades with a typed error. Show a
  // recoverable state — never a fabricated scenario.
  if (listQuery.isError) {
    const code = (listQuery.error as { code?: string })?.code;
    return (
      <Alert variant="warning" icon={<ServerCrash className="h-5 w-5" aria-hidden="true" />}>
        <AlertDescription>
          {code === 'SERVICE_UNAVAILABLE' ? t('errorUnavailable') : t('errorLoad')}
          <Button
            size="sm"
            variant="outline"
            className="ml-3"
            onClick={() => void listQuery.refetch()}
          >
            {t('retry')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      {lockedRoleModeLabel && (
        <Alert variant="info">
          <AlertDescription>
            {t('roleModeLockedBanner', { role: lockedRoleModeLabel })}
          </AlertDescription>
        </Alert>
      )}

      <Filters
        difficulty={difficulty}
        kind={kind}
        concept={concept}
        conceptIds={conceptIds}
        onDifficulty={setDifficulty}
        onKind={setKind}
        onConcept={setConcept}
      />

      {filtered.length === 0 ? (
        <ScenarioEmptyState degraded={degraded} onGenerate={() => generate.mutate()} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" role="list">
          {filtered.map((scenario) => (
            <li key={scenario.id}>
              <ScenarioCard scenario={scenario} language={language} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}

      {generate.isError && (
        <Alert variant="warning">
          <AlertDescription>{t('generateFailed')}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

interface FiltersProps {
  readonly difficulty: DifficultyFilter;
  readonly kind: KindFilter;
  readonly concept: ConceptFilter;
  readonly conceptIds: readonly string[];
  readonly onDifficulty: (v: DifficultyFilter) => void;
  readonly onKind: (v: KindFilter) => void;
  readonly onConcept: (v: ConceptFilter) => void;
}

function Filters({
  difficulty,
  kind,
  concept,
  conceptIds,
  onDifficulty,
  onKind,
  onConcept,
}: FiltersProps) {
  const t = useTranslations('training');
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Filter className="h-4 w-4" aria-hidden="true" />
        <span className="font-medium text-gray-700">{t('filters')}</span>
      </div>

      <SelectField
        id="filter-difficulty"
        label={t('difficulty')}
        value={difficulty}
        onChange={(v) => onDifficulty(v as DifficultyFilter)}
      >
        <option value="all">{t('all')}</option>
        {SCENARIO_DIFFICULTIES.map((d) => (
          <option key={d} value={d}>
            {t(`difficulty_${d}`)}
          </option>
        ))}
      </SelectField>

      <SelectField
        id="filter-kind"
        label={t('kind')}
        value={kind}
        onChange={onKind}
      >
        <option value="all">{t('all')}</option>
        {SCENARIO_KINDS.map((k) => (
          <option key={k} value={k}>
            {t(kindLabelKey(k))}
          </option>
        ))}
      </SelectField>

      <SelectField
        id="filter-concept"
        label={t('competency')}
        value={concept}
        onChange={onConcept}
        disabled={conceptIds.length === 0}
      >
        <option value="all">{t('all')}</option>
        {conceptIds.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

interface SelectFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly disabled?: boolean;
  readonly children: React.ReactNode;
}

function SelectField({ id, label, value, onChange, disabled, children }: SelectFieldProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-xs text-gray-500">
      <span className="font-medium text-gray-600">{label}</span>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[10rem] rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
      >
        {children}
      </select>
    </label>
  );
}

interface ScenarioCardProps {
  readonly scenario: ScenarioView;
  readonly language: TrainingLanguage;
  readonly onSelect: (scenario: ScenarioView) => void;
}

function ScenarioCard({ scenario, language, onSelect }: ScenarioCardProps) {
  const t = useTranslations('training');
  const title = language === 'sw' && scenario.titleSw ? scenario.titleSw : scenario.title;
  const summary =
    language === 'sw' && scenario.summarySw ? scenario.summarySw : scenario.summary;
  const tone = difficultyTone(scenario.difficulty);
  const objectives = scenario.briefing.objectives?.length ?? 0;
  const risks = scenario.briefing.hiddenRisks?.length ?? 0;

  return (
    <Card variant="default" hoverable className="flex h-full flex-col p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-sky-50 p-2">
          <GraduationCap className="h-5 w-5 text-sky-600" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{t(kindLabelKey(scenario.kind))}</p>
        </div>
        <Badge variant={tone.badge} size="sm">
          {t(`difficulty_${scenario.difficulty}`)}
        </Badge>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-gray-600">{summary}</p>

      <dl className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <dt className="sr-only">{t('estMinutes')}</dt>
          <dd className="tabular-nums">{t('minutesValue', { count: scenario.estimatedMinutes })}</dd>
        </div>
        <div className="flex items-center gap-1">
          <Target className="h-3.5 w-3.5" aria-hidden="true" />
          <dt className="sr-only">{t('objectivesLabel')}</dt>
          <dd className="tabular-nums">{t('objectivesValue', { count: objectives })}</dd>
        </div>
        {risks > 0 && (
          <div className="flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <dt className="sr-only">{t('risksLabel')}</dt>
            <dd className="tabular-nums">{t('risksValue', { count: risks })}</dd>
          </div>
        )}
      </dl>

      <Button className="mt-4" size="sm" onClick={() => onSelect(scenario)}>
        <Play className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {t('startScenario')}
      </Button>
    </Card>
  );
}

function BrowserSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * Empty state — two shapes:
 *   - `degraded` (backend resolved no catalog concept): offer a "generate"
 *     action that re-fetches.
 *   - filtered-out: a passive "no match" state with no action.
 * Kept as separate <Empty> calls so the optional `action` prop is omitted
 * entirely when absent (exactOptionalPropertyTypes-safe).
 */
function ScenarioEmptyState({
  degraded,
  onGenerate,
}: {
  readonly degraded: boolean;
  readonly onGenerate: () => void;
}) {
  const t = useTranslations('training');
  const icon = <GraduationCap className="h-8 w-8 text-gray-400" />;
  if (degraded) {
    return (
      <Empty
        variant="folder"
        icon={icon}
        title={t('emptyDegradedTitle')}
        description={t('emptyDegradedDesc')}
        action={{ label: t('generate'), onClick: onGenerate }}
      />
    );
  }
  return (
    <Empty
      variant="search"
      icon={icon}
      title={t('emptyTitle')}
      description={t('emptyDesc')}
    />
  );
}
