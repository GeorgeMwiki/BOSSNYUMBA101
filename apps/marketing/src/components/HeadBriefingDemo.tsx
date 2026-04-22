'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clock,
  MessageSquare,
  MoreHorizontal,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';

/**
 * HeadBriefingDemo — the flagship interactive demo.
 *
 * Shows what the Head of Estates sees at 7am: "Here is what I did
 * overnight, here is what needs your decision, here is where the
 * portfolio stands."
 *
 * Interactive affordances:
 *   - Approve / decline buttons on pending decisions (optimistic state)
 *   - Tab switcher (Overnight / Pending / KPIs)
 *   - Tenant-pulse timeline with hover detail
 *
 * Design intent: make it feel like an actual running product, not a
 * marketing screenshot. Real data density, real state transitions.
 */
export function HeadBriefingDemo() {
  const [tab, setTab] = useState<'overnight' | 'pending' | 'kpis'>('overnight');
  const [decisions, setDecisions] = useState<Record<string, 'idle' | 'approved' | 'declined'>>({
    'dec-01': 'idle',
    'dec-02': 'idle',
    'dec-03': 'idle',
  });

  function handleDecision(id: string, kind: 'approved' | 'declined') {
    setDecisions((s) => ({ ...s, [id]: kind }));
  }

  return (
    <section className="relative mx-auto max-w-7xl px-6 pb-24 lg:px-8" aria-labelledby="briefing-demo-heading">
      {/* Section header */}
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          01 · The Morning Briefing
        </p>
        <h2 id="briefing-demo-heading" className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Your first minute at 7am, every day.
        </h2>
        <p className="mx-auto mt-5 max-w-[52ch] text-lg leading-relaxed text-neutral-500">
          Overnight, Boss Nyumba handled routine operations across your portfolio.
          This is what it did, what it flagged for you, and what the numbers say.
        </p>
      </div>

      {/* The screen */}
      <div className="mt-14 rounded-2xl border border-border bg-surface shadow-xl">
        {/* Chrome strip */}
        <div className="flex items-center gap-4 border-b border-border px-5 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-neutral-300" />
            <span className="h-3 w-3 rounded-full bg-neutral-300" />
            <span className="h-3 w-3 rounded-full bg-neutral-300" />
          </div>
          <div className="mx-auto flex items-center gap-2 rounded-md bg-surface-sunken px-3 py-1 font-mono text-xs text-neutral-500">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            bossnyumba.com / briefing
          </div>
          <div className="w-16" />
        </div>

        {/* Briefing body */}
        <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
          {/* Left rail */}
          <aside className="border-b border-border p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-neutral-500">
              <Clock className="h-3.5 w-3.5" /> 07:04 · Nairobi
            </div>
            <h3 className="mt-4 font-display text-2xl font-medium leading-tight tracking-tight">
              Good morning, George.
            </h3>
            <p className="mt-2 text-sm text-neutral-500">
              Portfolio is steady. Three decisions need you before 10am.
            </p>

            <dl className="mt-6 space-y-3">
              <Stat label="Autonomous actions" value="148" delta="+12%" trend="up" />
              <Stat label="Escalations" value="3"   delta="-2"   trend="down" />
              <Stat label="Portfolio NOI" value="₦4.82M" delta="+0.4%" trend="up" />
              <Stat label="Tenant sentiment" value="0.81" delta="+0.03" trend="up" />
            </dl>
          </aside>

          {/* Right content */}
          <div className="flex flex-col">
            {/* Tabs */}
            <div role="tablist" aria-label="Briefing sections" className="flex gap-1 border-b border-border px-6 pt-4">
              {([
                ['overnight', 'Overnight · 148', <Sparkles className="h-3.5 w-3.5" key="s" />],
                ['pending',   'Pending · 3',     <AlertTriangle className="h-3.5 w-3.5" key="a" />],
                ['kpis',      'Portfolio',       <TrendingUp className="h-3.5 w-3.5" key="t" />],
              ] as const).map(([id, label, icon]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={[
                    'relative -mb-px inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors duration-fast',
                    tab === id
                      ? 'border-signal-500 text-foreground'
                      : 'border-transparent text-neutral-500 hover:text-foreground',
                  ].join(' ')}
                >
                  {icon}
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Panel */}
            <div className="flex-1 p-6">
              {tab === 'overnight' && <OvernightPanel />}
              {tab === 'pending' && (
                <PendingPanel decisions={decisions} onDecision={handleDecision} />
              )}
              {tab === 'kpis' && <KpiPanel />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- */
/* Sub-components                                             */
/* ---------------------------------------------------------- */

function Stat({
  label,
  value,
  delta,
  trend,
}: {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down';
}) {
  const positive = trend === 'up';
  return (
    <div className="border-l border-border pl-3">
      <dt className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">{label}</dt>
      <dd className="mt-1 flex items-baseline justify-between">
        <span className="font-display text-2xl font-medium tracking-tight tabular-nums">{value}</span>
        <span
          className={[
            'rounded-full px-1.5 py-0.5 font-mono text-[0.65rem]',
            positive ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger',
          ].join(' ')}
        >
          {delta}
        </span>
      </dd>
    </div>
  );
}

function OvernightPanel() {
  const items = [
    { domain: 'Finance',       action: 'Sent 47 rent reminders (5-day cohort)', count: 47,  time: '22:04' },
    { domain: 'Maintenance',   action: 'Dispatched 12 work orders to 4 trusted vendors', count: 12, time: '22:37' },
    { domain: 'Compliance',    action: 'Drafted 8 renewal notices for legal review', count: 8, time: '01:12' },
    { domain: 'Communications',action: 'Replied to 23 tenant WhatsApp threads', count: 23, time: '03:45' },
    { domain: 'Leasing',       action: 'Approved 6 same-terms renewals within policy', count: 6, time: '04:18' },
    { domain: 'Procurement',   action: 'Ran quarterly vendor rotation analysis', count: 1, time: '05:02' },
  ];
  return (
    <ol className="space-y-2.5">
      {items.map((it, i) => (
        <li
          key={i}
          className="group flex items-center gap-4 rounded-lg border border-transparent p-3 transition-colors duration-fast hover:border-border hover:bg-surface-raised"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signal-500/10 font-mono text-xs font-semibold text-signal-500 tabular-nums">
            {it.count}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
                {it.domain}
              </span>
              <span className="font-mono text-[0.68rem] text-neutral-500">· {it.time}</span>
            </div>
            <p className="mt-0.5 text-sm text-foreground">{it.action}</p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-neutral-400 opacity-0 transition-opacity duration-fast group-hover:opacity-100" />
        </li>
      ))}
    </ol>
  );
}

function PendingPanel({
  decisions,
  onDecision,
}: {
  decisions: Record<string, 'idle' | 'approved' | 'declined'>;
  onDecision: (id: string, kind: 'approved' | 'declined') => void;
}) {
  const items = [
    {
      id: 'dec-01',
      title: 'Rent waiver · Flat 3B, Westlands',
      body: 'Tenant requested a 30% waiver citing a medical emergency. Payment history: clean 22 months. Waiver exceeds your ₦250k auto-approve cap.',
      ask: 'Approve ₦82,500 waiver this month?',
      confidence: 0.74,
      domain: 'Finance',
    },
    {
      id: 'dec-02',
      title: 'Eviction notice · Bahari Towers 12F',
      body: 'Tenant is 47 days late. Two WhatsApp attempts unanswered. Statutory notice can be drafted but never auto-sent.',
      ask: 'Draft Section 8 notice for your review?',
      confidence: 0.91,
      domain: 'Legal',
    },
    {
      id: 'dec-03',
      title: 'Vendor payout · Mwangi Plumbing',
      body: 'Work completed, photos verified, tenant signed off. Amount ₦340,000 — exceeds your ₦250k auto-approve cap.',
      ask: 'Release payment now?',
      confidence: 0.96,
      domain: 'Procurement',
    },
  ];

  return (
    <ul className="space-y-4">
      {items.map((it) => {
        const state = decisions[it.id];
        return (
          <li
            key={it.id}
            className={[
              'rounded-xl border p-5 transition-all duration-base ease-out',
              state === 'approved' && 'border-success/50 bg-success-subtle/30',
              state === 'declined' && 'border-danger/40 bg-danger-subtle/30 opacity-60',
              state === 'idle' && 'border-border bg-surface hover:border-border-strong',
            ].filter(Boolean).join(' ')}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
                    {it.domain}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-signal-500/10 px-2 py-0.5 font-mono text-[0.65rem] font-medium text-signal-500">
                    <Sparkles className="h-2.5 w-2.5" /> {Math.round(it.confidence * 100)}% confident
                  </span>
                </div>
                <h4 className="mt-1 text-base font-semibold text-foreground">{it.title}</h4>
                <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-neutral-500">{it.body}</p>
                <p className="mt-3 text-sm font-medium text-foreground">{it.ask}</p>
              </div>
              <button className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-accent hover:text-foreground" aria-label="More options">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2">
              {state === 'idle' && (
                <>
                  <button
                    onClick={() => onDecision(it.id, 'approved')}
                    className="inline-flex items-center gap-1.5 rounded-md bg-signal-500 px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-fast ease-out hover:bg-signal-400 active:scale-[0.98]"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => onDecision(it.id, 'declined')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors duration-fast hover:bg-surface-raised"
                  >
                    <X className="h-3.5 w-3.5" /> Decline
                  </button>
                  <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-accent hover:text-foreground">
                    <MessageSquare className="h-3.5 w-3.5" /> Ask Mwikila
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
      })}
    </ul>
  );
}

function KpiPanel() {
  const bars = [62, 68, 71, 65, 74, 79, 76, 82, 85, 88, 84, 91];
  const max = Math.max(...bars);
  return (
    <div className="space-y-8">
      {/* NOI sparkline */}
      <div>
        <div className="flex items-baseline justify-between">
          <div>
            <h4 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
              Portfolio NOI · 12 months
            </h4>
            <p className="mt-1 font-display text-4xl font-medium tracking-tight tabular-nums">
              ₦4.82M <span className="font-mono text-sm text-success">+12.4%</span>
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">Occupancy</p>
            <p className="mt-1 font-display text-4xl font-medium tracking-tight tabular-nums">96.2%</p>
          </div>
        </div>
        <div className="mt-6 flex h-28 items-end gap-1.5">
          {bars.map((b, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-gradient-to-t from-signal-700/30 to-signal-500/80"
              style={{ height: `${(b / max) * 100}%` }}
              aria-label={`Month ${i + 1}: ${b}`}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[0.65rem] uppercase tracking-widest text-neutral-500">
          <span>May 25</span>
          <span>Apr 26</span>
        </div>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Collection rate', value: '97.4%',  delta: '+0.2' },
          { label: 'Avg time-to-fix', value: '38 h',   delta: '-14%' },
          { label: 'Churn risk',      value: '4.1%',   delta: '-0.8' },
          { label: 'Vacancy days',    value: '12.4',   delta: '-3.1' },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-surface-raised p-4">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-neutral-500">{k.label}</p>
            <p className="mt-1 font-display text-2xl font-medium tabular-nums">{k.value}</p>
            <p className="mt-1 font-mono text-[0.68rem] text-success">{k.delta}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
