import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, Plus } from 'lucide-react';
import { SkillLibraryGrid } from '../../components/SkillLibraryGrid';
import type { SkillSummary, SkillCategory, SkillTrigger } from '../../components/SkillCard';
import { MissingBackendNotice } from '../../components/MissingBackendNotice';

/**
 * /skills — owner-installable Skills marketplace.
 *
 * Top section: installed skills (toggle / run / view runs).
 * Bottom section: marketplace catalog. Filters: category + trigger kind.
 *
 * "Create new skill" opens an AOP-compiler chat in Jarvis (waits for the
 * E3 prompt-compiler wire to land; until then we just pre-fill the chat).
 */

const ENDPOINT = '/api/v1/owner/account/skills';

// Owner-portal auth is a Bearer token in localStorage (see src/lib/api.ts). The
// skills routes are auth + tenant-scoped, so every request MUST carry it.
// `credentials: 'include'` is kept for cookie-based deployments.
function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
  return fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
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
  const [state, setState] = useState<SkillsApiState>({ status: 'loading', skills: [] });
  const [categoryFilter, setCategoryFilter] = useState<SkillCategory | 'all'>('all');
  const [triggerFilter, setTriggerFilter] = useState<SkillTrigger | 'all'>('all');

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const res = await authedFetch(ENDPOINT);
        if (cancelled) return;
        if (res.status === 503) {
          setState({ status: 'missing', skills: [] });
          return;
        }
        if (!res.ok) {
          // No fabricated fallback — an API failure is surfaced honestly as an
          // error state with zero rows, never as a sample catalog.
          setState({ status: 'error', skills: [] });
          return;
        }
        const body = (await res.json()) as { skills?: ReadonlyArray<SkillSummary> };
        // Empty list is a legitimate "ok" — rendered as an honest empty-state.
        setState({ status: 'ok', skills: body.skills ?? [] });
      } catch {
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
    request: () => Promise<Response>,
  ): Promise<boolean> {
    const previous = state.skills.find((s) => s.id === skillId);
    if (!previous) return false;
    setState((prev) => ({
      ...prev,
      skills: prev.skills.map((s) => (s.id === skillId ? apply(s) : s)),
    }));
    try {
      const res = await request();
      if (!res.ok) throw new Error(`skill mutation failed: ${res.status}`);
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
        authedFetch(`${ENDPOINT}/${encodeURIComponent(skillId)}/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: nextEnabled }),
        }),
    );
  }

  function handleInstall(skillId: string): void {
    void persistSkillMutation(
      skillId,
      (s) => ({ ...s, installed: true, enabled: true }),
      () =>
        authedFetch(`${ENDPOINT}/${encodeURIComponent(skillId)}/install`, {
          method: 'POST',
        }),
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
        authedFetch(`${ENDPOINT}/${encodeURIComponent(skillId)}/run`, {
          method: 'POST',
        }),
    ).then((ok) => {
      if (ok) openInJarvis(`Run skill ${skill.slug} now.`);
    });
  }

  function openInJarvis(prompt: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(
        new CustomEvent('owner-portal:jarvis-prefill', {
          detail: { prompt, autoSubmit: false },
        }),
      );
    } catch {
      /* ignore */
    }
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
        endpoint={ENDPOINT}
        description="The owner-skills API has not been wired in api-gateway yet."
      />
    );
  }

  if (state.status === 'error') {
    return (
      <MissingBackendNotice
        title={t('marketplaceTitle')}
        endpoint={ENDPOINT}
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
