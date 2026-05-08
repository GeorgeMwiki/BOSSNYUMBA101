'use client';

/**
 * Estate manager root — the Head of Estates' post-login home.
 *
 * Dark-first, warm-amber-signal, Fraunces-display. Lean. The flagship
 * operator surface lives at /briefing; this page is the doorway to it
 * plus a compact snapshot of what Mwikila did overnight and what needs
 * the head's eyes.
 *
 * Data flow: a single TanStack Query against `headBriefingService.
 * getMyBriefing()` resolves the BriefingDocument the gateway composes
 * from autonomy / approvals / exception inbox / KPI sources. The
 * gateway returns 503 HEAD_BRIEFING_UNAVAILABLE when the composer is
 * not wired (degraded mode); we surface that as an honest empty state
 * with a retry affordance instead of a runtime crash.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileSearch,
  Gauge,
  Network,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Logomark } from '@bossnyumba/design-system';
import {
  headBriefingService,
  type BriefingDocument,
  type EscalationItem,
  type NotableAutonomousAction,
} from '@bossnyumba/api-client';

/* ──────────────────────────────  Types  ────────────────────────────── */

interface ActionTile {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly href: string;
  readonly tone: 'signal' | 'warning' | 'neutral' | 'success';
  readonly Icon: typeof AlertTriangle;
}

interface AutonomousAction {
  readonly id: string;
  readonly domain: string;
  readonly time: string;
  readonly body: string;
}

/* ──────────────────────────────  Page  ────────────────────────────── */

export default function ManagerHomePage() {
  const t = useTranslations('homePage');

  const briefingQuery = useQuery({
    queryKey: ['head-briefing', 'home'],
    queryFn: () => headBriefingService.getMyBriefing(),
    retry: 1,
    staleTime: 60_000,
  });

  const briefing: BriefingDocument | null = briefingQuery.data?.success
    ? briefingQuery.data.data
    : null;

  const tiles = useMemo<ReadonlyArray<ActionTile>>(
    () => buildActionTiles(briefing, t),
    [briefing, t],
  );

  const recentActions = useMemo<ReadonlyArray<AutonomousAction>>(
    () => buildRecentActions(briefing, t),
    [briefing, t],
  );

  const overnightTotal = briefing?.overnight.totalAutonomousActions ?? 0;
  const pendingCount = briefing?.pendingApprovals.count ?? 0;
  const isDegraded =
    briefingQuery.isError ||
    (briefingQuery.isSuccess && briefingQuery.data?.success === false);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 sm:py-12">
        {/* Good-morning greeting */}
        <header className="max-w-2xl">
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-signal-500">
            {formatDateBadge(briefing?.generatedAt)}
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
            {t('greeting')}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-neutral-500 sm:text-lg">
            {briefingQuery.isLoading
              ? t('loading')
              : isDegraded
              ? t('degradedSubtitle')
              : t.rich('overnightSummary', {
                  count: overnightTotal,
                  pending: pendingCount,
                  strong: (chunks) => (
                    <span className="tabular-nums text-foreground">{chunks}</span>
                  ),
                })}
          </p>
        </header>

        {/* Morning briefing hero */}
        <Link
          href="/briefing"
          className="group mt-8 flex flex-col items-start gap-5 rounded-2xl border border-signal-500/30 bg-signal-500/[0.04] p-6 transition-all duration-base ease-out hover:border-signal-500/60 hover:bg-signal-500/[0.07] sm:flex-row sm:items-center sm:gap-6 sm:p-8"
          aria-label={t('openBriefingAria')}
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-signal-500/10 ring-1 ring-signal-500/20 sm:h-16 sm:w-16">
            <Logomark size={36} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[0.68rem] uppercase tracking-widest text-signal-500">
              {t('briefingReady')}
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-medium leading-tight tracking-tight sm:text-3xl">
              {t('briefingHeroTitle')}
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-neutral-500 sm:text-base">
              {briefing?.headline ?? t('briefingHeroFallback')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start rounded-md bg-signal-500 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform duration-fast ease-out group-hover:translate-x-0.5 sm:self-center">
            {t('continue')}
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </Link>

        {/* Action tiles */}
        <section className="mt-10">
          <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
            {t('needsAttention')}
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {tiles.map((tile) => (
              <ActionTileCard key={tile.key} tile={tile} />
            ))}
          </div>
        </section>

        {/* Relationship explorer discovery tile */}
        <section className="mt-10">
          <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
            {t('explore')}
          </h2>
          <Link
            href="/graph"
            className="group mt-4 flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-all duration-fast ease-out hover:border-border-strong hover:bg-surface-raised sm:p-5"
            aria-label={t('relationshipExplorerAria')}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-signal-500/10 ring-1 ring-signal-500/20">
              <Network className="h-5 w-5 text-signal-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-lg font-medium leading-tight tracking-tight">
                {t('relationshipExplorerTitle')}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-500 sm:text-sm">
                {t('relationshipExplorerSubtitle')}
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-neutral-500 transition-colors group-hover:text-foreground" />
          </Link>
        </section>

        {/* Two-column split: recent actions + autonomy */}
        <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:gap-8">
          {/* Recent autonomous actions */}
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
                {t('latestActions')}
              </h2>
              <Link
                href="/briefing#overnight"
                className="flex items-center gap-1 text-xs font-medium text-neutral-500 transition-colors duration-fast hover:text-foreground"
              >
                {t('viewAll', { count: overnightTotal })}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            {briefingQuery.isLoading ? (
              <ActionRowSkeletons />
            ) : recentActions.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-sm text-neutral-500">
                {isDegraded ? t('degradedListMessage') : t('emptyOvernight')}
              </p>
            ) : (
              <ol className="mt-4 space-y-1.5">
                {recentActions.map((action) => (
                  <ActionRow key={action.id} action={action} />
                ))}
              </ol>
            )}
          </div>

          {/* Autonomy level */}
          <aside>
            <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
              {t('autonomy')}
            </h2>
            <div className="mt-4 rounded-xl border border-border bg-surface-raised p-5">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-signal-500" />
                <span className="inline-flex items-center rounded-full bg-signal-500/10 px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-widest text-signal-500 tabular-nums">
                  {t('autonomyLevelBadge')}
                </span>
              </div>
              <p className="mt-3 font-display text-2xl font-medium leading-tight tracking-tight">
                {t('autonomyHeadline')}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                {t('autonomySubtitle', { redlines: pendingCount })}
              </p>
              <Link
                href="/autonomy"
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-signal-500 transition-colors duration-fast hover:text-signal-400"
              >
                {t('tunePolicy')}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </aside>
        </section>

        {/* Footer strip */}
        <footer className="mt-16 flex items-center justify-between border-t border-border pt-6">
          <div className="flex items-center gap-2.5">
            <Logomark size={20} />
            <span className="font-mono text-[0.72rem] text-neutral-500">
              {t('footerToday', { time: formatTime(briefing?.generatedAt) })}
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[0.68rem] text-neutral-500">
            <span
              className={
                'h-1.5 w-1.5 rounded-full ' +
                (isDegraded ? 'bg-warning' : 'bg-success')
              }
            />
            <span>{isDegraded ? t('systemsDegraded') : t('systemsOk')}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ────────────────────────  Derivation helpers  ────────────────────── */

function buildActionTiles(
  briefing: BriefingDocument | null,
  t: ReturnType<typeof useTranslations>,
): ReadonlyArray<ActionTile> {
  const pending = briefing?.pendingApprovals.count ?? 0;
  const escalations = briefing?.escalations.count ?? 0;
  const autoRenewals = briefing?.overnight.byDomain.leasing ?? 0;
  const flagged =
    briefing?.escalations.byPriority.P3 ??
    briefing?.recommendations.length ??
    0;

  return [
    {
      key: 'pending',
      label: t('tilePending'),
      count: pending,
      href: '/briefing#pending',
      tone: 'signal',
      Icon: Sparkles,
    },
    {
      key: 'escalations',
      label: t('tileEscalations'),
      count: escalations,
      href: '/briefing#escalations',
      tone: 'warning',
      Icon: AlertTriangle,
    },
    {
      key: 'auto-renewals',
      label: t('tileAutoRenewals'),
      count: autoRenewals,
      href: '/leases?filter=auto-renewal',
      tone: 'success',
      Icon: RefreshCw,
    },
    {
      key: 'flagged',
      label: t('tileFlagged'),
      count: flagged,
      href: '/briefing#flagged',
      tone: 'neutral',
      Icon: FileSearch,
    },
  ];
}

function buildRecentActions(
  briefing: BriefingDocument | null,
  t: ReturnType<typeof useTranslations>,
): ReadonlyArray<AutonomousAction> {
  if (!briefing) return [];
  // Combine notable autonomous actions with the top escalations so the
  // landing feed reflects "what Mwikila did" + "what bubbled up".
  const fromNotable: ReadonlyArray<AutonomousAction> =
    briefing.overnight.notableActions.map((a: NotableAutonomousAction) => ({
      id: a.actionId,
      domain: domainLabel(a.domain, t),
      time: '',
      body: a.summary,
    }));
  const fromEscalations: ReadonlyArray<AutonomousAction> =
    briefing.escalations.items.map((e: EscalationItem) => ({
      id: e.exceptionId,
      domain: e.domain,
      time: '',
      body: e.summary,
    }));
  return [...fromNotable, ...fromEscalations].slice(0, 6);
}

function formatDateBadge(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return '';
  }
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

/**
 * Translate an AutonomyDomain key to a localised label. next-intl
 * throws on missing keys, so we wrap each lookup in a guard and fall
 * back to a Title-Cased version of the raw key.
 */
function domainLabel(
  key: string,
  t: ReturnType<typeof useTranslations>,
): string {
  try {
    return t(`domain.${key}`);
  } catch {
    return capitalize(key.replace(/_/g, ' '));
  }
}

/* ────────────────────────  Presentation kit  ──────────────────────── */

function ActionTileCard({ tile }: { readonly tile: ActionTile }) {
  const toneClasses: Record<ActionTile['tone'], string> = {
    signal: 'text-signal-500',
    warning: 'text-warning',
    success: 'text-success',
    neutral: 'text-neutral-500',
  };

  return (
    <Link
      href={tile.href}
      className="group flex flex-col justify-between gap-6 rounded-xl border border-border bg-surface p-4 transition-all duration-fast ease-out hover:border-border-strong hover:bg-surface-raised sm:p-5"
    >
      <div className="flex items-center justify-between">
        <tile.Icon className={`h-4 w-4 ${toneClasses[tile.tone]}`} />
        <ArrowUpRight className="h-3.5 w-3.5 text-neutral-500 opacity-0 transition-opacity duration-fast group-hover:opacity-100" />
      </div>
      <div>
        <p className="font-display text-3xl font-medium leading-none tracking-tight tabular-nums sm:text-4xl">
          {tile.count}
        </p>
        <p className="mt-2 text-xs leading-snug text-neutral-500 sm:text-sm">
          {tile.label}
        </p>
      </div>
    </Link>
  );
}

function ActionRow({ action }: { readonly action: AutonomousAction }) {
  return (
    <li className="flex items-start gap-4 rounded-lg border border-transparent p-3 transition-colors duration-fast hover:border-border hover:bg-surface-raised">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signal-500/10">
        <CheckCircle2 className="h-3.5 w-3.5 text-signal-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
            {action.domain}
          </span>
          {action.time ? (
            <span className="font-mono text-[0.68rem] text-neutral-500">
              <Clock className="mr-1 inline h-2.5 w-2.5" />
              <span className="tabular-nums">{action.time}</span>
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm leading-relaxed text-foreground">
          {action.body}
        </p>
      </div>
    </li>
  );
}

function ActionRowSkeletons() {
  return (
    <ol className="mt-4 space-y-1.5" aria-busy="true" aria-live="polite">
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="flex items-start gap-4 rounded-lg border border-transparent p-3"
        >
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-signal-500/10" />
          <div className="flex-1 space-y-2">
            <div className="h-2 w-24 animate-pulse rounded bg-border" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-border" />
          </div>
        </li>
      ))}
    </ol>
  );
}
