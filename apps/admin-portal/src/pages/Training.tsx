import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { GraduationCap, Sparkles, Users, Map, CheckCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, Button, Skeleton } from '@bossnyumba/design-system';
import { api } from '../lib/api';

interface TrainingPathStep {
  readonly id: string;
  readonly orderIndex: number;
  readonly conceptId: string;
  readonly kind: string;
  readonly title: string;
  readonly estimatedMinutes: number;
  readonly masteryThreshold: number;
}

interface TrainingPath {
  readonly id: string;
  readonly title: string;
  readonly topic: string;
  readonly audience: string;
  readonly language: string;
  readonly durationMinutes: number;
  readonly conceptIds: readonly string[];
  readonly summary: string;
  readonly steps: readonly TrainingPathStep[];
  readonly createdAt: string;
}

interface TrainingAssignment {
  readonly id: string;
  readonly pathId: string;
  readonly assigneeUserId: string;
  readonly status: string;
  readonly progressPct: number;
  readonly dueAt?: string | null;
}

const AUDIENCES = [
  'station-masters',
  'estate-officers',
  'caretakers',
  'accountants',
  'owners',
  'tenants',
  'custom',
] as const;

type Audience = (typeof AUDIENCES)[number];
type Language = 'en' | 'sw' | 'both';

function progressColor(pct: number): string {
  if (pct >= 0.8) return 'bg-green-500';
  if (pct >= 0.4) return 'bg-blue-500';
  return 'bg-amber-500';
}

function TrainingGenerateForm({
  onGenerated,
}: {
  onGenerated: (path: TrainingPath) => void;
}): JSX.Element {
  const t = useTranslations('training');
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState<Audience>('estate-officers');
  const [duration, setDuration] = useState(2);
  const [language, setLanguage] = useState<Language>('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(): Promise<void> {
    setBusy(true);
    setError(null);
    const res = await api.post<TrainingPath>('/training/generate', {
      topic,
      audience,
      durationHours: duration,
      language,
    });
    setBusy(false);
    if (res.success && res.data) {
      onGenerated(res.data);
      setTopic('');
    } else {
      setError(res.error ?? 'Generation failed');
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-violet-600" />
        <h3 className="font-semibold text-gray-900">{t('generateTitle')}</h3>
      </div>
      <p className="text-sm text-gray-500">{t('generateSubtitle')}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="text-gray-700">{t('topicLabel')}</span>
          <input
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t('topicPlaceholder')}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">{t('audienceLabel')}</span>
          <select
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={audience}
            onChange={(e) => setAudience(e.target.value as Audience)}
          >
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">{t('durationLabel')}</span>
          <input
            type="number"
            min={0.5}
            max={40}
            step={0.5}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">{t('languageLabel')}</span>
          <select
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            <option value="en">{t('languages.en')}</option>
            <option value="sw">{t('languages.sw')}</option>
            <option value="both">{t('languages.both')}</option>
          </select>
        </label>
      </div>
      {error && (
        <Alert variant="danger">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        onClick={handleGenerate}
        disabled={busy || topic.trim().length < 3}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          t('generateCta')
        )}
      </Button>
    </div>
  );
}

function GeneratedPreview({
  path,
  onSaved,
  onDiscard,
}: {
  path: TrainingPath;
  onSaved: (saved: TrainingPath) => void;
  onDiscard: () => void;
}): JSX.Element {
  const t = useTranslations('training');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    const res = await api.post<TrainingPath>('/training/paths', {
      path: {
        title: path.title,
        topic: path.topic,
        audience: path.audience,
        language: path.language,
        durationMinutes: path.durationMinutes,
        conceptIds: path.conceptIds,
        summary: path.summary,
        steps: path.steps.map((s) => ({
          conceptId: s.conceptId,
          kind: s.kind,
          title: s.title,
          content: {},
          masteryThreshold: s.masteryThreshold,
          estimatedMinutes: s.estimatedMinutes,
        })),
      },
    });
    setBusy(false);
    if (res.success && res.data) {
      onSaved(res.data);
    } else {
      setError(res.error ?? 'Save failed');
    }
  }

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-violet-900">{path.title}</h4>
        <span className="text-xs text-violet-700">
          {path.durationMinutes} min · {path.steps.length} steps
        </span>
      </div>
      <p className="text-sm text-violet-800">{path.summary}</p>
      <ol className="space-y-2">
        {path.steps.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 text-sm text-gray-700"
          >
            <span className="text-xs font-semibold text-violet-600">
              {s.orderIndex + 1}.
            </span>
            <span className="flex-1">{s.title}</span>
            <span className="text-xs text-gray-500">
              {s.kind} · {s.estimatedMinutes}m
            </span>
          </li>
        ))}
      </ol>
      {error && (
        <Alert variant="danger">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('saveCta')}
        </Button>
        <Button variant="secondary" onClick={onDiscard}>
          {t('discardCta')}
        </Button>
      </div>
    </div>
  );
}

function ActiveAssignmentsPanel({
  assignments,
  loading,
}: {
  assignments: readonly TrainingAssignment[];
  loading: boolean;
}): JSX.Element {
  const t = useTranslations('training');
  if (loading) return <Skeleton className="h-32 w-full" />;
  if (assignments.length === 0)
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-500">
        {t('assignmentsEmpty')}
      </div>
    );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-violet-600" />
        <h3 className="font-semibold text-gray-900">{t('assignmentsTitle')}</h3>
      </div>
      <ul className="space-y-3">
        {assignments.map((a) => (
          <li key={a.id} className="text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-800">
                {a.assigneeUserId}
              </span>
              <span className="text-xs text-gray-500">{a.status}</span>
            </div>
            <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`${progressColor(a.progressPct)} h-full transition-all`}
                style={{ width: `${Math.round(a.progressPct * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MasteryHeatmap({
  paths,
  assignments,
}: {
  paths: readonly TrainingPath[];
  assignments: readonly TrainingAssignment[];
}): JSX.Element {
  const t = useTranslations('training');
  const employees = useMemo(
    () => Array.from(new Set(assignments.map((a) => a.assigneeUserId))),
    [assignments]
  );
  const concepts = useMemo(
    () => Array.from(new Set(paths.flatMap((p) => p.conceptIds))),
    [paths]
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Map className="h-5 w-5 text-violet-600" />
        <h3 className="font-semibold text-gray-900">{t('masteryTitle')}</h3>
      </div>
      {concepts.length === 0 || employees.length === 0 ? (
        <p className="text-sm text-gray-500">{t('masteryEmpty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left">{t('masteryEmployee')}</th>
                {concepts.map((c) => (
                  <th key={c} className="px-2 py-1">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((uid) => (
                <tr key={uid}>
                  <td className="px-2 py-1 text-gray-700">{uid}</td>
                  {concepts.map((c) => (
                    <td
                      key={c}
                      className="px-2 py-1 bg-gray-100 text-center text-gray-400"
                    >
                      {/* heatmap cells — filled once GET /mastery/:userId wires in */}
                      -
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function TrainingPage(): JSX.Element {
  const t = useTranslations('training');
  const [preview, setPreview] = useState<TrainingPath | null>(null);
  const [paths, setPaths] = useState<readonly TrainingPath[]>([]);
  const [assignments, setAssignments] = useState<readonly TrainingAssignment[]>(
    []
  );
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<readonly TrainingPath[]>('/training/paths'),
      api.get<readonly TrainingAssignment[]>('/training/assignments'),
    ]).then(([p, a]) => {
      if (!active) return;
      if (p.success && p.data) setPaths(p.data);
      if (a.success && a.data) setAssignments(a.data);
      setLoadingAssignments(false);
    });
    return () => {
      active = false;
    };
  }, []);

  function onSaved(saved: TrainingPath): void {
    setPaths((prev) => [...prev, saved]);
    setPreview(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-6 w-6 text-violet-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('title')}</h2>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
      </div>

      <TrainingGenerateForm onGenerated={setPreview} />

      {preview && (
        <GeneratedPreview
          path={preview}
          onSaved={onSaved}
          onDiscard={() => setPreview(null)}
        />
      )}

      {paths.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">{t('pathsTitle')}</h3>
          </div>
          <ul className="space-y-2 text-sm">
            {paths.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0"
              >
                <span className="text-gray-800">{p.title}</span>
                <span className="text-xs text-gray-500">
                  {p.audience} · {p.durationMinutes}m
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ActiveAssignmentsPanel
        assignments={assignments}
        loading={loadingAssignments}
      />

      <MasteryHeatmap paths={paths} assignments={assignments} />
    </div>
  );
}
