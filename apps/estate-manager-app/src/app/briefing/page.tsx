'use client';

/**
 * Head Briefing — the flagship operator surface.
 *
 * Open at 7am. Read for 60 seconds. Decide, or let Mwikila finish.
 *
 * Layout:
 *   - 3-column grid (left rail / centre feed / right sidebar) on ≥lg
 *   - Collapses to single column on mobile with tab navigation
 *
 * Left rail  : good-morning panel, portfolio health KPIs, autonomy level
 * Centre     : overnight autonomous actions timeline, pending decisions
 *              (approve / decline inline), escalations list
 * Right rail : tenant-sentiment strip, upcoming-week outlook, a "ask
 *              Mwikila" prompt
 *
 * Data flow: a single TanStack Query against `headBriefingService.
 * getMyBriefing()` resolves the BriefingDocument the gateway composes
 * from autonomy, approvals, exception inbox and KPI sources. The
 * gateway returns 503 HEAD_BRIEFING_UNAVAILABLE when the composer is
 * not wired (degraded mode); we surface that as honest empty sections
 * with a retry affordance — the page never black-screens.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clock,
  Gauge,
  MessageSquare,
  MoreHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { Logomark, ScrubbableChart } from '@bossnyumba/design-system';
import {
  headBriefingService,
  type BriefingDocument,
  type EscalationItem,
  type KpiDelta,
  type KpiDelta30d,
  type NotableAutonomousAction,
  type PendingApprovalItem,
} from '@bossnyumba/api-client';

type DecisionState = 'idle' | 'approved' | 'declined';

export default function BriefingPage() {
  const t = useTranslations('briefingPage');
  const [decisions, setDecisions] = useState<Record<string, DecisionState>>({});

  const briefingQuery = useQuery({
    queryKey: ['head-briefing', 'full'],
    queryFn: () => headBriefingService.getMyBriefing(),
    retry: 1,
    staleTime: 60_000,
  });

  const briefing: BriefingDocument | null = briefingQuery.data?.success
    ? briefingQuery.data.data
    : null;
  const isDegraded =
    briefingQuery.isError ||
    (briefingQuery.isSuccess && briefingQuery.data?.success === false);

  const decide = (id: string, state: Exclude<DecisionState, 'idle'>) =>
    setDecisions((s) => ({ ...s, [id]: state }));

  return (
    <div className="min-h-screen bg-background">
      {/* Top banner strip */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-6">
          <div className="flex items-center gap-2">
            <Logomark size={26} />
            <span className="font-display text-xl font-medium tracking-tight">
              {t('title')}
            </span>
          </div>
          <div className="mx-auto flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 font-mono text-xs text-neutral-500">
            <Clock className="h-3.5 w-3.5" />
            <span className="tabular-nums">
              {formatTime(briefing?.generatedAt)}
            </span>
            <span className="mx-1 h-3 w-px bg-border" />
            <span
              className={
                'h-1.5 w-1.5 rounded-full ' +
                (isDegraded ? 'bg-warning' : 'bg-success')
              }
            />
            <span>{isDegraded ? t('systemsDegraded') : t('systemsOk')}</span>
          </div>
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-500 transition-colors duration-fast hover:bg-accent hover:text-foreground"
          >
            {t('exit')}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr_320px]">
          {/* ──────────────────────  LEFT RAIL  ────────────────────── */}
          <aside className="space-y-6">
            <section>
              <p className="font-mono text-[0.68rem] uppercase tracking-widest text-signal-500">
                {formatDateBadge(briefing?.generatedAt)}
              </p>
              <h1 className="mt-2 font-display text-3xl font-medium leading-tight tracking-tight">
                {t('greeting')}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                {briefingQuery.isLoading
                  ? t('loading')
                  : briefing?.headline ??
                    (isDegraded ? t('degradedSubtitle') : t('quietStart'))}
              </p>
            </section>

            {/* KPIs */}
            <section className="space-y-3">
              <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
                {t('portfolioHealth')}
              </h2>
              {briefingQuery.isLoading ? (
                <KpiSkeletons />
              ) : (
                <KpiList
                  briefing={briefing}
                  totalActionsLabel={t('kpiAutonomous')}
                  escalationsLabel={t('kpiEscalations')}
                  noiLabel={t('kpiNoi')}
                  sentimentLabel={t('kpiSentiment')}
                  collectionsLabel={t('kpiCollections')}
                  occupancyLabel={t('kpiOccupancy')}
                />
              )}
            </section>

            {/* Autonomy */}
            <section className="rounded-lg border border-border bg-surface-raised p-4">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-signal-500" />
                <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
                  {t('autonomy')}
                </h2>
              </div>
              <p className="mt-2 font-display text-3xl font-medium tabular-nums leading-none">
                {t('autonomyLevelBadge')}
              </p>
              <p className="mt-1 font-display text-lg font-medium">
                {t('autonomyHeadline')}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                {t('autonomySubtitle', {
                  redlines: briefing?.pendingApprovals.count ?? 0,
                })}
              </p>
              <Link
                href="/autonomy"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-signal-500 transition-colors hover:text-signal-400"
              >
                {t('tunePolicy')}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </section>
          </aside>

          {/* ──────────────────────  CENTRE FEED  ───────────────────── */}
          <main className="space-y-10">
            {/* Overnight */}
            <section id="overnight">
              <div className="mb-4 flex items-baseline justify-between">
                <div>
                  <p className="font-mono text-[0.68rem] uppercase tracking-widest text-signal-500">
                    {t('overnightLabel', {
                      count: briefing?.overnight.totalAutonomousActions ?? 0,
                    })}
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-medium tracking-tight">
                    {t('overnightTitle')}
                  </h2>
                </div>
                <Link
                  href="/audit-trail"
                  className="flex items-center gap-1 text-xs font-medium text-neutral-500 transition-colors hover:text-foreground"
                >
                  {t('fullAuditTrail')}
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>

              {briefingQuery.isLoading ? (
                <OvernightSkeletons />
              ) : (briefing?.overnight.notableActions.length ?? 0) === 0 ? (
                <EmptyBlock
                  message={
                    isDegraded ? t('degradedListMessage') : t('emptyOvernight')
                  }
                />
              ) : (
                <ol className="space-y-1.5">
                  {briefing!.overnight.notableActions.map((it) => (
                    <OvernightRow key={it.actionId} action={it} />
                  ))}
                </ol>
              )}
            </section>

            {/* Pending decisions */}
            <section id="pending">
              <div className="mb-4 flex items-baseline justify-between">
                <div>
                  <p className="font-mono text-[0.68rem] uppercase tracking-widest text-warning">
                    {t('pendingLabel', {
                      count: briefing?.pendingApprovals.count ?? 0,
                    })}
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-medium tracking-tight">
                    {t('pendingTitle')}
                  </h2>
                </div>
              </div>

              {briefingQuery.isLoading ? (
                <DecisionSkeletons />
              ) : (briefing?.pendingApprovals.items.length ?? 0) === 0 ? (
                <EmptyBlock
                  message={
                    isDegraded ? t('degradedListMessage') : t('emptyPending')
                  }
                />
              ) : (
                <ul className="space-y-4">
                  {briefing!.pendingApprovals.items.map((it) => (
                    <DecisionCard
                      key={it.approvalId}
                      item={it}
                      state={decisions[it.approvalId] ?? 'idle'}
                      onDecide={decide}
                      labels={{
                        approve: t('approve'),
                        decline: t('decline'),
                        ask: t('askMwikila'),
                        escalate: t('escalate'),
                        approved: t('approvedLogged'),
                        declined: t('declinedLogged'),
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>

            {/* Escalations */}
            <section id="escalations">
              <div className="mb-4 flex items-baseline justify-between">
                <div>
                  <p className="font-mono text-[0.68rem] uppercase tracking-widest text-warning">
                    {t('escalationsLabel', {
                      count: briefing?.escalations.count ?? 0,
                    })}
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-medium tracking-tight">
                    {t('escalationsTitle')}
                  </h2>
                </div>
              </div>
              {briefingQuery.isLoading ? (
                <OvernightSkeletons />
              ) : (briefing?.escalations.items.length ?? 0) === 0 ? (
                <EmptyBlock
                  message={
                    isDegraded
                      ? t('degradedListMessage')
                      : t('emptyEscalations')
                  }
                />
              ) : (
                <ol className="space-y-1.5">
                  {briefing!.escalations.items.map((e) => (
                    <EscalationRow key={e.exceptionId} item={e} />
                  ))}
                </ol>
              )}
            </section>
          </main>

          {/* ──────────────────────  RIGHT RAIL  ───────────────────── */}
          <aside className="space-y-6">
            <SentimentCard
              briefing={briefing}
              title={t('sentimentTitle')}
              subtitle={t('sentimentSubtitle')}
              ariaLabel={t('sentimentAria')}
            />

            {/* Recommendations */}
            <section className="rounded-lg border border-border bg-surface p-4">
              <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
                {t('recommendationsTitle')}
              </h2>
              {briefingQuery.isLoading ? (
                <div className="mt-3 h-12 animate-pulse rounded bg-border" />
              ) : (briefing?.recommendations.length ?? 0) === 0 ? (
                <p className="mt-3 text-sm text-neutral-500">
                  {isDegraded
                    ? t('degradedListMessage')
                    : t('emptyRecommendations')}
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {briefing!.recommendations.slice(0, 4).map((r) => (
                    <li key={r.topic} className="text-sm">
                      <p className="font-medium text-foreground">{r.topic}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
                        {r.summary}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Ask Mwikila */}
            <section className="rounded-lg border border-signal-500/30 bg-signal-500/[0.04] p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-signal-500" />
                <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-signal-500">
                  {t('askMwikilaTitle')}
                </h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                {t.rich('askMwikilaTry', {
                  italic: (chunks) => (
                    <span className="italic text-neutral-500">{chunks}</span>
                  ),
                })}
              </p>
              <div className="mt-3">
                <input
                  type="text"
                  placeholder={t('askPlaceholder')}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────  Helpers  ─────────────────────────── */

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

/* ────────────────────────  Presentation kit  ───────────────────────── */

interface KpiListProps {
  readonly briefing: BriefingDocument | null;
  readonly totalActionsLabel: string;
  readonly escalationsLabel: string;
  readonly noiLabel: string;
  readonly sentimentLabel: string;
  readonly collectionsLabel: string;
  readonly occupancyLabel: string;
}

function KpiList(props: KpiListProps) {
  const k = props.briefing?.kpiDeltas;
  return (
    <>
      <StatRow
        label={props.totalActionsLabel}
        value={String(props.briefing?.overnight.totalAutonomousActions ?? 0)}
        delta={null}
      />
      <StatRow
        label={props.escalationsLabel}
        value={String(props.briefing?.escalations.count ?? 0)}
        delta={null}
      />
      <StatRow
        label={props.noiLabel}
        value={
          k ? formatNumber(k.noi.value) : '—'
        }
        delta={k ? formatDelta(k.noi) : null}
      />
      <StatRow
        label={props.sentimentLabel}
        value={k ? formatPercent(k.tenantSatisfaction.value) : '—'}
        delta={k ? formatDelta(k.tenantSatisfaction) : null}
      />
      <StatRow
        label={props.collectionsLabel}
        value={k ? formatPercent(k.collectionsRate.value) : '—'}
        delta={k ? formatDelta(k.collectionsRate) : null}
      />
      <StatRow
        label={props.occupancyLabel}
        value={k ? formatPercent(k.occupancyPct.value) : '—'}
        delta={k ? formatDelta(k.occupancyPct) : null}
      />
    </>
  );
}

function KpiSkeletons() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="border-l border-border pl-3">
          <div className="h-2 w-20 animate-pulse rounded bg-border" />
          <div className="mt-2 h-5 w-16 animate-pulse rounded bg-border" />
        </div>
      ))}
    </div>
  );
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

function formatDelta(d: KpiDelta | KpiDelta30d): {
  readonly text: string;
  readonly trend: 'up' | 'down' | 'flat';
} {
  const v = 'delta7d' in d ? d.delta7d : d.delta30d;
  const trend: 'up' | 'down' | 'flat' =
    v > 0.001 ? 'up' : v < -0.001 ? 'down' : 'flat';
  const text =
    trend === 'flat' ? '0.0' : (v > 0 ? '+' : '') + v.toFixed(2);
  return { text, trend };
}

function StatRow({
  label,
  value,
  delta,
}: {
  readonly label: string;
  readonly value: string;
  readonly delta: { readonly text: string; readonly trend: 'up' | 'down' | 'flat' } | null;
}) {
  const chipClass = !delta
    ? 'bg-neutral-100 text-neutral-500'
    : delta.trend === 'up'
    ? 'bg-success-subtle text-success'
    : delta.trend === 'down'
    ? 'bg-danger-subtle text-danger'
    : 'bg-neutral-100 text-neutral-500';
  return (
    <div className="border-l border-border pl-3">
      <dt className="font-mono text-[0.65rem] uppercase tracking-widest text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 flex items-baseline justify-between">
        <span className="font-display text-xl font-medium tracking-tight tabular-nums">
          {value}
        </span>
        {delta ? (
          <span
            className={`rounded-full px-1.5 py-0.5 font-mono text-[0.62rem] ${chipClass}`}
          >
            {delta.text}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function OvernightRow({
  action,
}: {
  readonly action: NotableAutonomousAction;
}) {
  return (
    <li className="group flex items-center gap-4 rounded-lg border border-transparent p-3 transition-colors duration-fast hover:border-border hover:bg-surface-raised">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal-500/10 font-mono text-xs font-semibold text-signal-500 tabular-nums">
        {Math.round(action.confidence * 100)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
            {action.domain}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-foreground">{action.summary}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-neutral-400 opacity-0 transition-opacity duration-fast group-hover:opacity-100" />
    </li>
  );
}

function EscalationRow({ item }: { readonly item: EscalationItem }) {
  const priorityClass =
    item.priority === 'P1'
      ? 'text-danger'
      : item.priority === 'P2'
      ? 'text-warning'
      : 'text-neutral-500';
  return (
    <li className="group flex items-start gap-4 rounded-lg border border-transparent p-3 transition-colors duration-fast hover:border-border hover:bg-surface-raised">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/10 font-mono text-xs font-semibold tabular-nums ${priorityClass}`}
      >
        {item.priority}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
            {item.domain}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-foreground">{item.summary}</p>
      </div>
    </li>
  );
}

function EmptyBlock({ message }: { readonly message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-8 text-sm text-neutral-500">
      {message}
    </p>
  );
}

function OvernightSkeletons() {
  return (
    <ol className="space-y-1.5" aria-busy="true" aria-live="polite">
      {[0, 1, 2, 3, 4].map((i) => (
        <li
          key={i}
          className="flex items-center gap-4 rounded-lg border border-transparent p-3"
        >
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-signal-500/10" />
          <div className="flex-1 space-y-2">
            <div className="h-2 w-20 animate-pulse rounded bg-border" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-border" />
          </div>
        </li>
      ))}
    </ol>
  );
}

function DecisionSkeletons() {
  return (
    <ul className="space-y-4" aria-busy="true" aria-live="polite">
      {[0, 1].map((i) => (
        <li
          key={i}
          className="rounded-xl border border-border bg-surface p-5 space-y-3"
        >
          <div className="h-2 w-24 animate-pulse rounded bg-border" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-border" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-border" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-border" />
        </li>
      ))}
    </ul>
  );
}

interface DecisionCardLabels {
  readonly approve: string;
  readonly decline: string;
  readonly ask: string;
  readonly escalate: string;
  readonly approved: string;
  readonly declined: string;
}

function DecisionCard({
  item,
  state,
  onDecide,
  labels,
}: {
  readonly item: PendingApprovalItem;
  readonly state: DecisionState;
  readonly onDecide: (id: string, state: Exclude<DecisionState, 'idle'>) => void;
  readonly labels: DecisionCardLabels;
}) {
  const urgencyColor =
    item.urgency === 'high'
      ? 'text-danger'
      : item.urgency === 'medium'
      ? 'text-warning'
      : 'text-neutral-500';

  return (
    <li
      className={[
        'rounded-xl border p-5 transition-all duration-base ease-out',
        state === 'approved' && 'border-success/40 bg-success-subtle/30',
        state === 'declined' && 'border-danger/40 bg-danger-subtle/30 opacity-60',
        state === 'idle' && 'border-border bg-surface hover:border-border-strong',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
              {item.kind}
            </span>
            <span
              className={`font-mono text-[0.62rem] uppercase tracking-widest ${urgencyColor}`}
            >
              · {item.urgency}
            </span>
          </div>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-foreground">
            {item.summary}
          </p>
        </div>
        <button
          className="rounded-md p-2 text-neutral-500 transition-colors duration-fast hover:bg-accent hover:text-foreground"
          aria-label="More options"
          type="button"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {state === 'idle' && (
          <>
            <button
              type="button"
              onClick={() => onDecide(item.approvalId, 'approved')}
              className="inline-flex items-center gap-1.5 rounded-md bg-signal-500 px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-fast ease-out hover:bg-signal-400 hover:shadow-md active:scale-[0.98]"
            >
              <Check className="h-3.5 w-3.5" /> {labels.approve}
            </button>
            <button
              type="button"
              onClick={() => onDecide(item.approvalId, 'declined')}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors duration-fast hover:bg-surface-raised"
            >
              <X className="h-3.5 w-3.5" /> {labels.decline}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-500 transition-colors duration-fast hover:bg-accent hover:text-foreground"
            >
              <MessageSquare className="h-3.5 w-3.5" /> {labels.ask}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-500 transition-colors duration-fast hover:bg-accent hover:text-foreground"
            >
              <AlertTriangle className="h-3.5 w-3.5" /> {labels.escalate}
            </button>
          </>
        )}
        {state === 'approved' && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-success-subtle px-3 py-1.5 text-sm font-medium text-success">
            <Check className="h-3.5 w-3.5" /> {labels.approved}
          </span>
        )}
        {state === 'declined' && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-danger-subtle px-3 py-1.5 text-sm font-medium text-danger">
            <X className="h-3.5 w-3.5" /> {labels.declined}
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * SentimentCard — tenant-sentiment trend with scrubbing.
 *
 * Today the gateway surfaces only the latest 30-day reading on the
 * BriefingDocument. Until the data warehouse exposes a 7-day series we
 * derive a flat-line trend that still scrubs. The chart never invents
 * volatility.
 */
function SentimentCard({
  briefing,
  title,
  subtitle,
  ariaLabel,
}: {
  readonly briefing: BriefingDocument | null;
  readonly title: string;
  readonly subtitle: string;
  readonly ariaLabel: string;
}) {
  const latest = briefing?.kpiDeltas.tenantSatisfaction.value ?? 0;
  const series = useMemo<readonly number[]>(() => {
    // Until a 7-day series is exposed, we surface the current reading
    // as a flat line so the chart still renders honestly.
    return [latest, latest, latest, latest, latest, latest, latest];
  }, [latest]);
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
  const previous = series[series.length - 2] ?? latest;
  const delta = latest - previous;

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
        {title}
      </h2>
      <ScrubbableChart
        className="mt-4"
        series={[
          { name: 'Sentiment', values: [...series], color: 'signal' },
        ]}
        labels={[...labels]}
        formatValue={(v) => v.toFixed(2)}
        height={100}
        ariaLabel={ariaLabel}
        header={({ activeIndex, activeLabel, activeValues }) => {
          const isScrub = activeIndex !== null;
          const value = isScrub ? activeValues[0] ?? latest : latest;
          const deltaChip = isScrub ? null : (
            <span className="rounded-full bg-success-subtle px-2 py-0.5 font-mono text-[0.65rem] text-success">
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(2)}
            </span>
          );
          return (
            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-display text-3xl font-medium tabular-nums">
                  {value.toFixed(2)}
                </span>
                {isScrub && activeLabel && (
                  <span className="ml-2 font-mono text-[0.65rem] uppercase tracking-widest text-neutral-500">
                    {activeLabel}
                  </span>
                )}
              </div>
              {deltaChip}
            </div>
          );
        }}
      />
      <p className="mt-3 text-xs leading-relaxed text-neutral-500">
        {subtitle}
      </p>
    </section>
  );
}
