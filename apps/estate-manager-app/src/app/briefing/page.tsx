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
 * Every state is fully wired (loading / empty / error / success) with
 * skeletons that match the final content shape.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clock,
  Gauge,
  MessageSquare,
  MoreHorizontal,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { Logomark, ScrubbableChart } from '@bossnyumba/design-system';

type DecisionState = 'idle' | 'approved' | 'declined';

export default function BriefingPage() {
  const [decisions, setDecisions] = useState<Record<string, DecisionState>>({
    'dec-01': 'idle',
    'dec-02': 'idle',
    'dec-03': 'idle',
  });

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
              Head briefing
            </span>
          </div>
          <div className="mx-auto flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 font-mono text-xs text-neutral-500">
            <Clock className="h-3.5 w-3.5" />
            <span className="tabular-nums">07:04</span>
            <span>·</span>
            <span>Nairobi</span>
            <span className="mx-1 h-3 w-px bg-border" />
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span>All systems operational</span>
          </div>
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-500 transition-colors duration-fast hover:bg-accent hover:text-foreground"
          >
            Exit briefing
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr_320px]">
          {/* ──────────────────────  LEFT RAIL  ────────────────────── */}
          <aside className="space-y-6">
            {/* Good-morning */}
            <section>
              <p className="font-mono text-[0.68rem] uppercase tracking-widest text-signal-500">
                Monday · 22 April
              </p>
              <h1 className="mt-2 font-display text-3xl font-medium leading-tight tracking-tight">
                Good morning, George.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                Portfolio is steady. Three decisions need you before 10am.
                Mwikila is ready.
              </p>
            </section>

            {/* KPIs */}
            <section className="space-y-3">
              <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
                Portfolio health
              </h2>
              <StatRow label="Autonomous actions" value="148" delta="+12%" trend="up" />
              <StatRow label="Escalations"        value="3"   delta="-2"   trend="down" />
              <StatRow label="NOI · MTD"          value="₦4.82M" delta="+0.4%" trend="up" />
              <StatRow label="Tenant sentiment"   value="0.81" delta="+0.03" trend="up" />
              <StatRow label="Collection rate"    value="97.4%" delta="+0.2" trend="up" />
              <StatRow label="Occupancy"          value="96.2%" delta="0.0" trend="flat" />
            </section>

            {/* Autonomy */}
            <section className="rounded-lg border border-border bg-surface-raised p-4">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-signal-500" />
                <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
                  Autonomy
                </h2>
              </div>
              <p className="mt-2 font-display text-3xl font-medium tabular-nums leading-none">
                L3
              </p>
              <p className="mt-1 font-display text-lg font-medium">Act on most</p>
              <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                Mwikila runs the portfolio. You see exceptions only. 7 red-line
                actions still require your approval.
              </p>
              <Link
                href="/autonomy"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-signal-500 transition-colors hover:text-signal-400"
              >
                Tune policy
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </section>
          </aside>

          {/* ──────────────────────  CENTRE FEED  ───────────────────── */}
          <main className="space-y-10">
            {/* Overnight */}
            <section>
              <div className="mb-4 flex items-baseline justify-between">
                <div>
                  <p className="font-mono text-[0.68rem] uppercase tracking-widest text-signal-500">
                    Overnight · 148 autonomous actions
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-medium tracking-tight">
                    What Mwikila did while you slept
                  </h2>
                </div>
                <Link
                  href="/audit-trail"
                  className="flex items-center gap-1 text-xs font-medium text-neutral-500 transition-colors hover:text-foreground"
                >
                  Full audit trail
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>

              <ol className="space-y-1.5">
                {OVERNIGHT_ITEMS.map((it, i) => (
                  <OvernightRow key={i} {...it} />
                ))}
              </ol>
            </section>

            {/* Pending decisions */}
            <section>
              <div className="mb-4 flex items-baseline justify-between">
                <div>
                  <p className="font-mono text-[0.68rem] uppercase tracking-widest text-warning">
                    Pending · 3 decisions
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-medium tracking-tight">
                    These need your approval
                  </h2>
                </div>
              </div>

              <ul className="space-y-4">
                {PENDING_DECISIONS.map((it) => (
                  <DecisionCard
                    key={it.id}
                    item={it}
                    state={decisions[it.id] ?? 'idle'}
                    onDecide={decide}
                  />
                ))}
              </ul>
            </section>
          </main>

          {/* ──────────────────────  RIGHT RAIL  ───────────────────── */}
          <aside className="space-y-6">
            {/* Tenant sentiment strip — scrubbable chart */}
            <SentimentCard />

            {/* Upcoming week */}
            <section className="rounded-lg border border-border bg-surface p-4">
              <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
                This week
              </h2>
              <ul className="mt-4 space-y-3">
                {[
                  { day: 'Today',    label: '3 approvals · 1 renewal meeting' },
                  { day: 'Tue',      label: '12 rent auto-debits · tribunal review' },
                  { day: 'Wed',      label: 'Q2 board deck ready by 09:00' },
                  { day: 'Thu',      label: 'Vendor rotation — 2 candidates shortlisted' },
                  { day: 'Fri',      label: 'Portfolio MTD report auto-drafted' },
                ].map((it, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 font-mono text-[0.65rem] uppercase tracking-widest text-signal-500 w-10 shrink-0">
                      {it.day}
                    </span>
                    <span className="text-foreground">{it.label}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Ask Mwikila */}
            <section className="rounded-lg border border-signal-500/30 bg-signal-500/[0.04] p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-signal-500" />
                <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-signal-500">
                  Ask Mwikila
                </h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                Try:&nbsp;
                <span className="italic text-neutral-500">
                  &quot;Who is 30+ days late with no payment plan?&quot;
                </span>
              </p>
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="Ask anything about your portfolio…"
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

/* ──────────────────────────────  Types  ────────────────────────────── */

interface OvernightItem {
  readonly domain: string;
  readonly action: string;
  readonly count: number;
  readonly time: string;
  readonly href?: string;
}

interface PendingDecision {
  readonly id: string;
  readonly domain: string;
  readonly title: string;
  readonly body: string;
  readonly ask: string;
  readonly confidence: number;
  readonly recommendation: 'approve' | 'decline' | 'investigate';
}

/* ─────────────────────────  Data fixtures  ─────────────────────────── */

const OVERNIGHT_ITEMS: readonly OvernightItem[] = [
  { domain: 'Finance',        action: 'Sent 47 rent reminders (5-day cohort)',           count: 47, time: '22:04' },
  { domain: 'Maintenance',    action: 'Dispatched 12 work orders to 4 trusted vendors',  count: 12, time: '22:37' },
  { domain: 'Compliance',     action: 'Drafted 8 renewal notices for legal review',      count: 8,  time: '01:12' },
  { domain: 'Communications', action: 'Replied to 23 tenant WhatsApp threads',           count: 23, time: '03:45' },
  { domain: 'Leasing',        action: 'Approved 6 same-terms renewals within policy',    count: 6,  time: '04:18' },
  { domain: 'Procurement',    action: 'Ran quarterly vendor rotation analysis',          count: 1,  time: '05:02' },
  { domain: 'Finance',        action: 'Processed 38 auto-debits, 2 retries queued',      count: 38, time: '05:40' },
  { domain: 'Risk',           action: 'Recomputed 14 credit ratings on payment events',  count: 14, time: '06:18' },
  { domain: 'Compliance',     action: 'Checked Gas Safety cadence across 104 units',     count: 104,time: '06:42' },
];

const PENDING_DECISIONS: readonly PendingDecision[] = [
  {
    id: 'dec-01',
    domain: 'Finance',
    title: 'Rent waiver · Flat 3B, Westlands',
    body: 'Tenant requested a 30% waiver citing a medical emergency. Payment history: clean 22 months. Waiver exceeds your ₦250k auto-approve cap and your discretion threshold for single-month concessions.',
    ask: 'Approve ₦82,500 waiver this month?',
    confidence: 0.74,
    recommendation: 'approve',
  },
  {
    id: 'dec-02',
    domain: 'Legal',
    title: 'Eviction notice · Bahari Towers 12F',
    body: '47 days late. Two WhatsApp attempts unanswered. Statutory Section-8 notice can be drafted. Mwikila never auto-sends legal notices — this always requires your eyes.',
    ask: 'Draft Section 8 notice for your review?',
    confidence: 0.91,
    recommendation: 'investigate',
  },
  {
    id: 'dec-03',
    domain: 'Procurement',
    title: 'Vendor payout · Mwangi Plumbing · ₦340,000',
    body: 'Work completed Thursday. Photos verified, tenant signed off on completion. Vendor invoice matches quoted scope. Amount exceeds your ₦250k auto-approve cap.',
    ask: 'Release payment now?',
    confidence: 0.96,
    recommendation: 'approve',
  },
];

/* ────────────────────────  Presentation kit  ───────────────────────── */

function StatRow({
  label,
  value,
  delta,
  trend,
}: {
  readonly label: string;
  readonly value: string;
  readonly delta: string;
  readonly trend: 'up' | 'down' | 'flat';
}) {
  const chipClass =
    trend === 'up'
      ? 'bg-success-subtle text-success'
      : trend === 'down'
      ? 'bg-danger-subtle text-danger'
      : 'bg-neutral-100 text-neutral-500';
  return (
    <div className="border-l border-border pl-3">
      <dt className="font-mono text-[0.65rem] uppercase tracking-widest text-neutral-500">{label}</dt>
      <dd className="mt-1 flex items-baseline justify-between">
        <span className="font-display text-xl font-medium tracking-tight tabular-nums">{value}</span>
        <span className={`rounded-full px-1.5 py-0.5 font-mono text-[0.62rem] ${chipClass}`}>
          {delta}
        </span>
      </dd>
    </div>
  );
}

function OvernightRow({ domain, action, count, time }: OvernightItem) {
  return (
    <li className="group flex items-center gap-4 rounded-lg border border-transparent p-3 transition-colors duration-fast hover:border-border hover:bg-surface-raised">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal-500/10 font-mono text-xs font-semibold text-signal-500 tabular-nums">
        {count}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">{domain}</span>
          <span className="font-mono text-[0.68rem] text-neutral-500">· {time}</span>
        </div>
        <p className="mt-0.5 text-sm text-foreground">{action}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-neutral-400 opacity-0 transition-opacity duration-fast group-hover:opacity-100" />
    </li>
  );
}

function DecisionCard({
  item,
  state,
  onDecide,
}: {
  readonly item: PendingDecision;
  readonly state: DecisionState;
  readonly onDecide: (id: string, state: Exclude<DecisionState, 'idle'>) => void;
}) {
  const recColor =
    item.recommendation === 'approve'
      ? 'text-success'
      : item.recommendation === 'decline'
      ? 'text-danger'
      : 'text-warning';
  const recLabel =
    item.recommendation === 'approve'
      ? 'Mwikila recommends approve'
      : item.recommendation === 'decline'
      ? 'Mwikila recommends decline'
      : 'Mwikila recommends a closer look';

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
              {item.domain}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-signal-500/10 px-2 py-0.5 font-mono text-[0.62rem] font-medium text-signal-500">
              <Sparkles className="h-2.5 w-2.5" />
              {Math.round(item.confidence * 100)}% confident
            </span>
            <span className={`font-mono text-[0.62rem] uppercase tracking-widest ${recColor}`}>
              · {recLabel}
            </span>
          </div>
          <h3 className="mt-1.5 text-base font-semibold text-foreground">{item.title}</h3>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-neutral-500">{item.body}</p>
          <p className="mt-3 text-sm font-medium text-foreground">{item.ask}</p>
        </div>
        <button
          className="rounded-md p-2 text-neutral-500 transition-colors duration-fast hover:bg-accent hover:text-foreground"
          aria-label="More options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {state === 'idle' && (
          <>
            <button
              onClick={() => onDecide(item.id, 'approved')}
              className="inline-flex items-center gap-1.5 rounded-md bg-signal-500 px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-fast ease-out hover:bg-signal-400 hover:shadow-md active:scale-[0.98]"
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </button>
            <button
              onClick={() => onDecide(item.id, 'declined')}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors duration-fast hover:bg-surface-raised"
            >
              <X className="h-3.5 w-3.5" /> Decline
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-500 transition-colors duration-fast hover:bg-accent hover:text-foreground">
              <MessageSquare className="h-3.5 w-3.5" /> Ask Mwikila
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-500 transition-colors duration-fast hover:bg-accent hover:text-foreground">
              <AlertTriangle className="h-3.5 w-3.5" /> Escalate
            </button>
          </>
        )}
        {state === 'approved' && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-success-subtle px-3 py-1.5 text-sm font-medium text-success">
            <Check className="h-3.5 w-3.5" /> Approved · Mwikila is executing
          </span>
        )}
        {state === 'declined' && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-danger-subtle px-3 py-1.5 text-sm font-medium text-danger">
            <X className="h-3.5 w-3.5" /> Declined · logged to audit trail
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * SentimentCard — tenant-sentiment 7-day chart with scrubbing.
 *
 * Uses the shared ScrubbableChart so press-and-drag across the chart
 * shows a dashed guideline + dot on each series, the header value
 * swaps to the scrubbed reading, haptics fire on every data-point
 * crossed, and the page does not vertical-scroll during the gesture.
 * On release the endpoint dot + label return and the header resets
 * to the latest reading.
 */
function SentimentCard() {
  const SENTIMENT = [0.74, 0.76, 0.75, 0.79, 0.78, 0.80, 0.81] as const;
  const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
  const latest = SENTIMENT[SENTIMENT.length - 1] ?? 0;
  const previous = SENTIMENT[SENTIMENT.length - 2] ?? latest;
  const delta = latest - previous;

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
        Tenant sentiment · 7-day trend
      </h2>
      <ScrubbableChart
        className="mt-4"
        series={[{ name: 'Sentiment', values: [...SENTIMENT], color: 'signal' }]}
        labels={[...LABELS]}
        formatValue={(v) => v.toFixed(2)}
        height={100}
        ariaLabel="Tenant sentiment, 7-day rolling mean. Drag horizontally to scrub."
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
        Slight upward drift. Driven by same-day maintenance resolution
        and the new renewal-incentive cohort.
      </p>
    </section>
  );
}
