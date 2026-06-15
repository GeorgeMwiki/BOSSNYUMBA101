import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { Sparkles, Plus } from 'lucide-react';
import { SkillLibraryGrid } from '../../components/SkillLibraryGrid';
import type { SkillSummary, SkillCategory, SkillTrigger } from '../../components/SkillCard';
import { MissingBackendNotice } from '../../components/MissingBackendNotice';
import { openJarvisWithPrefill } from '../../lib/jarvis-prefill';
import { api } from '../../lib/api';

/**
 * /skills — owner-installable Skills marketplace.
 *
 * Top section: installed skills (toggle / run / view runs).
 * Bottom section: marketplace catalog. Filters: category + trigger kind.
 *
 * "Create new skill" opens an AOP-compiler chat in Jarvis (waits for the
 * E3 prompt-compiler wire to land; until then we just pre-fill the chat).
 *
 * Backed by `/api/v1/owner/account/skills/*` (owner-account.hono.ts). The
 * base URL + `/api/v1` prefix + bearer are resolved by `lib/api` from
 * `VITE_API_URL`, so the page works in the nginx-served prod build (no Vite
 * dev proxy). The bare relative endpoint below is for display only —
 * MissingBackendNotice shows it to the operator; it is never fetched.
 */

// Path relative to the shared api client's `/api/v1` base. The client
// prepends VITE_API_URL + `/api/v1`, so this resolves in prod and dev alike.
const SKILLS_PATH = '/owner/account/skills';
// Public-facing form shown in MissingBackendNotice (the operator-readable URL).
const PUBLIC_ENDPOINT = `/api/v1${SKILLS_PATH}`;

// The 503 db-unavailable envelope carries this code; it is the signal that the
// backend is not wired (honest MissingBackendNotice rather than a fake list).
const DATABASE_UNAVAILABLE = 'DATABASE_UNAVAILABLE';

// Envelope returned by the shared api client (see src/lib/api.ts). The skills
// routes answer `{ success, skills }` on read and `{ success, data }` on write.
interface SkillsListResponse {
  readonly success?: boolean;
  readonly skills?: ReadonlyArray<SkillSummary>;
  readonly error?: { readonly code?: string };
}

interface SkillMutationResponse {
  readonly success?: boolean;
  readonly data?: SkillSummary;
  readonly error?: { readonly code?: string };
}

interface SkillsApiState {
  // 'missing'  → backend explicitly not wired (503): honest MissingBackendNotice.
  // 'error'    → request failed (4xx/5xx/network): honest error state, no fake rows.
  // 'ok'       → real skills loaded (possibly an empty list → honest empty-state).
  readonly status: 'loading' | 'ok' | 'missing' | 'error';
  readonly skills: ReadonlyArray<SkillSummary>;
}

const ALL_CATEGORIES: ReadonlyArray<SkillCategory | 'all'> = [
  'all',
  'arrears',
  'lease',
  'maintenance',
  'comms',
  'compliance',
  'reporting',
];

const ALL_TRIGGERS: ReadonlyArray<SkillTrigger | 'all'> = ['all', 'cron', 'event', 'manual'];

export default function SkillsPage(): JSX.Element {
  const t = useTranslations('p89.skills');
  const navigate = useNavigate();
  const [state, setState] = useState<SkillsApiState>({ status: 'loading', skills: [] });
  const [categoryFilter, setCategoryFilter] = useState<SkillCategory | 'all'>('all');
  const [triggerFilter, setTriggerFilter] = useState<SkillTrigger | 'all'>('all');

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const body = (await api.get<unknown>(SKILLS_PATH)) as SkillsListResponse;
        if (cancelled) return;
        if (body.error?.code === DATABASE_UNAVAILABLE) {
          // 503 db-unavailable → honest MissingBackendNotice, not a fake list.
          setState({ status: 'missing', skills: [] });
          return;
        }
        if (body.success === false) {
          // No fabricated fallback — an API failure is surfaced honestly as an
          // error state with zero rows, never as a sample catalog.
          setState({ status: 'error', skills: [] });
          return;
        }
        // Empty list is a legitimate "ok" — rendered as an honest empty-state.
        setState({ status: 'ok', skills: body.skills ?? [] });
      } catch {
        // Network failure / unconfigured base URL — surfaced honestly as error.
        if (!cancelled) setState({ status: 'error', skills: [] });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const installed = useMemo(
    () => state.skills.filter((s) => s.installed),
    [state.skills],
  );
  const marketplace = useMemo(
    () => state.skills.filter((s) => !s.installed),
    [state.skills],
  );
  const filteredMarketplace = useMemo(() => {
    return marketplace.filter((s) => {
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (triggerFilter !== 'all' && s.triggerKind !== triggerFilter) return false;
      return true;
    });
  }, [marketplace, categoryFilter, triggerFilter]);

  // Mutations act ONLY on skills that already exist in live state (loaded from
  // the API). Each one optimistically updates, calls the real route, and
  // reverts the optimistic edit on failure — never a silent fake-success.
  async function persistSkillMutation(
    skillId: string,
    apply: (skill: SkillSummary) => SkillSummary,
    request: () => Promise<SkillMutationResponse>,
  ): Promise<boolean> {
    const previous = state.skills.find((s) => s.id === skillId);
    if (!previous) return false;
    setState((prev) => ({
      ...prev,
      skills: prev.skills.map((s) => (s.id === skillId ? apply(s) : s)),
    }));
    try {
      const res = await request();
      if (res.success !== true) {
        throw new Error(`skill mutation failed: ${res.error?.code ?? 'unknown'}`);
      }
      return true;
    } catch {
      // Revert the optimistic edit so the UI never shows an un-persisted state.
      setState((prev) => ({
        ...prev,
        skills: prev.skills.map((s) => (s.id === skillId ? previous : s)),
      }));
      return false;
    }
  }

  function handleToggle(skillId: string, nextEnabled: boolean): void {
    void persistSkillMutation(
      skillId,
      (s) => ({ ...s, enabled: nextEnabled }),
      () =>
        api.post<unknown>(
          `${SKILLS_PATH}/${encodeURIComponent(skillId)}/toggle`,
          { enabled: nextEnabled },
        ) as Promise<SkillMutationResponse>,
    );
  }

  function handleInstall(skillId: string): void {
    void persistSkillMutation(
      skillId,
      (s) => ({ ...s, installed: true, enabled: true }),
      () =>
        api.post<unknown>(
          `${SKILLS_PATH}/${encodeURIComponent(skillId)}/install`,
        ) as Promise<SkillMutationResponse>,
    );
  }

  function handleRun(skillId: string): void {
    const skill = state.skills.find((s) => s.id === skillId);
    if (!skill) return;
    void persistSkillMutation(
      skillId,
      (s) => ({
        ...s,
        runCount: s.runCount + 1,
        lastRunAt: new Date().toISOString().slice(0, 10),
      }),
      () =>
        api.post<unknown>(
          `${SKILLS_PATH}/${encodeURIComponent(skillId)}/run`,
        ) as Promise<SkillMutationResponse>,
    ).then((ok) => {
      if (ok) openInJarvis(`Run skill ${skill.slug} now.`);
    });
  }

  // Hand the prompt to the Jarvis composer route via react-router location
  // state. Deterministic (no listener-less window event) — the /jarvis page
  // reads the prefill on mount, seeds its input, and lets the owner edit
  // before sending (autoSubmit defaults to false).
  function openInJarvis(prompt: string): void {
    navigate(...openJarvisWithPrefill(prompt));
  }

  function createNewSkill(): void {
    openInJarvis(
      'Help me create a new owner Skill. Open the AOP-compiler wizard.',
    );
  }

  if (state.status === 'missing') {
    return (
      <MissingBackendNotice
        title={t('marketplaceTitle')}
        endpoint={PUBLIC_ENDPOINT}
        description="The owner-skills API has not been wired in api-gateway yet."
      />
    );
  }

  if (state.status === 'error') {
    return (
      <MissingBackendNotice
        title={t('marketplaceTitle')}
        endpoint={PUBLIC_ENDPOINT}
        description="The owner-skills API could not be reached. No skills are shown until it responds."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Sparkles className="h-6 w-6 text-violet-600" />
            {t('title')}
          </h1>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={createNewSkill}
          className="inline-flex items-center gap-1 rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> {t('createSkill')}
        </button>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">
          {t('installedHeading', { count: installed.length })}
        </h2>
        <SkillLibraryGrid
          skills={installed}
          onToggle={handleToggle}
          onInstall={handleInstall}
          onRun={handleRun}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">
          {t('marketplaceHeading', { count: filteredMarketplace.length })}
        </h2>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-gray-500">{t('categoryLabel')}</span>
          {ALL_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoryFilter(c)}
              className={`rounded-full px-2 py-0.5 ${
                categoryFilter === c
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-200 bg-white text-gray-700'
              }`}
            >
              {t(`category.${c}`)}
            </button>
          ))}
          <span className="ml-4 text-gray-500">{t('triggerLabel')}</span>
          {ALL_TRIGGERS.map((trig) => (
            <button
              key={trig}
              type="button"
              onClick={() => setTriggerFilter(trig)}
              className={`rounded-full px-2 py-0.5 ${
                triggerFilter === trig
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-200 bg-white text-gray-700'
              }`}
            >
              {t(`trigger.${trig}`)}
            </button>
          ))}
        </div>
        <SkillLibraryGrid
          skills={filteredMarketplace}
          onToggle={handleToggle}
          onInstall={handleInstall}
          onRun={handleRun}
        />
      </section>
    </div>
  );
}
