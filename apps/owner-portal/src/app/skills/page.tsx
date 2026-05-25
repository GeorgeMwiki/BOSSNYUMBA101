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

const ENDPOINT = '/api/v1/owner/skills';

const SAMPLE_SKILLS: ReadonlyArray<SkillSummary> = [
  {
    id: 'sk-arrears-friday',
    name: 'Arrears Friday digest',
    slug: 'arrears-friday-digest',
    description:
      "Every Friday 08:30 EAT, email the top 10 arrears tenants with their case state and proposed next step. Owner reviews & approves before send.",
    author: 'Mr. Mwikila',
    authorIsMd: true,
    category: 'arrears',
    triggerKind: 'cron',
    triggerLabel: 'Friday 08:30 EAT',
    installed: true,
    enabled: true,
    runCount: 14,
    lastRunAt: '2026-05-15',
    rating: 4.8,
  },
  {
    id: 'sk-kra-monthly',
    name: 'KRA monthly filing compiler',
    slug: 'kra-monthly-filing',
    description:
      'On the 1st of each month, compile the prior month MRI receipts, validate against the rent roll, and produce a draft KRA filing.',
    author: 'Mr. Mwikila',
    authorIsMd: true,
    category: 'compliance',
    triggerKind: 'cron',
    triggerLabel: 'Monthly · 1st',
    installed: true,
    enabled: false,
    runCount: 3,
    lastRunAt: '2026-04-01',
    rating: 4.6,
  },
  {
    id: 'sk-lease-renewal',
    name: 'Lease renewal early-warning',
    slug: 'lease-renewal-90d',
    description:
      'Triggers 90 days before each lease end-date. Drafts a renewal letter + a market-rate comparison and pings the owner.',
    author: 'Mr. Mwikila',
    authorIsMd: true,
    category: 'lease',
    triggerKind: 'event',
    triggerLabel: 'lease.expires_in.<=90d',
    installed: false,
    enabled: false,
    runCount: 0,
    rating: 4.7,
  },
  {
    id: 'sk-vendor-callout',
    name: 'Vendor SLA call-out',
    slug: 'vendor-sla-callout',
    description:
      'If a work-order exceeds vendor SLA by 25%, call the vendor with a scripted reminder and log the response.',
    author: 'Mr. Mwikila',
    authorIsMd: true,
    category: 'maintenance',
    triggerKind: 'event',
    triggerLabel: 'workorder.sla.breach',
    installed: false,
    enabled: false,
    runCount: 0,
    rating: 4.4,
  },
  {
    id: 'sk-owner-newsletter',
    name: 'Owner monthly newsletter',
    slug: 'owner-monthly-newsletter',
    description:
      'On the 5th of each month, compile a newsletter for co-owners with NOI, occupancy, and the top three operational highlights.',
    author: 'Estate Operators Co.',
    authorIsMd: false,
    category: 'comms',
    triggerKind: 'cron',
    triggerLabel: 'Monthly · 5th',
    installed: false,
    enabled: false,
    runCount: 0,
    rating: 4.2,
  },
  {
    id: 'sk-eviction-checklist',
    name: 'Eviction checklist runner',
    slug: 'eviction-checklist',
    description:
      'When an arrears case crosses 90 days, run the compliant eviction checklist with HIL approval at every irreversible step.',
    author: 'Mr. Mwikila',
    authorIsMd: true,
    category: 'compliance',
    triggerKind: 'manual',
    installed: true,
    enabled: true,
    runCount: 1,
    lastRunAt: '2026-04-22',
    rating: 4.9,
  },
];

interface SkillsApiState {
  readonly status: 'loading' | 'ok' | 'missing' | 'fallback';
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
        const res = await fetch(ENDPOINT, { credentials: 'include' });
        if (cancelled) return;
        if (res.status === 503) {
          setState({ status: 'missing', skills: [] });
          return;
        }
        if (!res.ok) {
          setState({ status: 'fallback', skills: SAMPLE_SKILLS });
          return;
        }
        const body = (await res.json()) as { skills?: ReadonlyArray<SkillSummary> };
        setState({ status: 'ok', skills: body.skills ?? [] });
      } catch {
        if (!cancelled) setState({ status: 'fallback', skills: SAMPLE_SKILLS });
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

  function handleToggle(skillId: string, nextEnabled: boolean): void {
    setState((prev) => ({
      ...prev,
      skills: prev.skills.map((s) =>
        s.id === skillId ? { ...s, enabled: nextEnabled } : s,
      ),
    }));
  }

  function handleInstall(skillId: string): void {
    setState((prev) => ({
      ...prev,
      skills: prev.skills.map((s) =>
        s.id === skillId ? { ...s, installed: true, enabled: true } : s,
      ),
    }));
  }

  function handleRun(skillId: string): void {
    const skill = state.skills.find((s) => s.id === skillId);
    if (!skill) return;
    setState((prev) => ({
      ...prev,
      skills: prev.skills.map((s) =>
        s.id === skillId
          ? {
              ...s,
              runCount: s.runCount + 1,
              lastRunAt: new Date().toISOString().slice(0, 10),
            }
          : s,
      ),
    }));
    openInJarvis(`Run skill ${skill.slug} now.`);
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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Sparkles className="h-6 w-6 text-violet-600" />
            Skills marketplace
          </h1>
          <p className="text-sm text-gray-500">
            Install workflows Mr. Mwikila can run on a schedule, on an event, or
            on demand. Toggle them off any time.
          </p>
          {state.status === 'fallback' ? (
            <p className="mt-1 text-xs text-amber-700">
              Skills API not yet wired. Showing a sample catalog.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={createNewSkill}
          className="inline-flex items-center gap-1 rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> Create new Skill
        </button>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">
          Installed ({installed.length})
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
          Marketplace ({filteredMarketplace.length})
        </h2>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-gray-500">Category:</span>
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
              {c}
            </button>
          ))}
          <span className="ml-4 text-gray-500">Trigger:</span>
          {ALL_TRIGGERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTriggerFilter(t)}
              className={`rounded-full px-2 py-0.5 ${
                triggerFilter === t
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-200 bg-white text-gray-700'
              }`}
            >
              {t}
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
