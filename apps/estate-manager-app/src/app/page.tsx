/**
 * Estate manager root — the Head of Estates' post-login home.
 *
 * Dark-first, warm-amber-signal, Fraunces-display. Lean. The flagship
 * operator surface lives at /briefing; this page is the doorway to it
 * plus a compact snapshot of what Mwikila did overnight and what needs
 * the head's eyes.
 *
 * Data note: every count / feed entry below is static demo data for
 * now. Wire to TanStack Query (head-briefing.router, autonomy-guard)
 * in a follow-up — this file deliberately does zero fetching so the
 * landing experience renders instantly on first paint.
 */

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileSearch,
  Gauge,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Logomark } from '@bossnyumba/design-system';

/* ──────────────────────────────  Demo data  ────────────────────────────── */
// TODO(data): Replace with TanStack Query against head-briefing router.
const OPERATOR_NAME = 'George';
const OVERNIGHT_ACTIONS = 148;

interface ActionTile {
  readonly label: string;
  readonly count: number;
  readonly href: string;
  readonly tone: 'signal' | 'warning' | 'neutral' | 'success';
  readonly Icon: typeof AlertTriangle;
}

const ACTION_TILES: readonly ActionTile[] = [
  {
    label: 'Pending decisions',
    count: 3,
    href: '/briefing#pending',
    tone: 'signal',
    Icon: Sparkles,
  },
  {
    label: 'Escalations',
    count: 1,
    href: '/briefing#escalations',
    tone: 'warning',
    Icon: AlertTriangle,
  },
  {
    label: 'Auto-renewals',
    count: 6,
    href: '/leases?filter=auto-renewal',
    tone: 'success',
    Icon: RefreshCw,
  },
  {
    label: 'Flagged for review',
    count: 2,
    href: '/briefing#flagged',
    tone: 'neutral',
    Icon: FileSearch,
  },
];

interface AutonomousAction {
  readonly domain: string;
  readonly time: string;
  readonly body: string;
}

const RECENT_ACTIONS: readonly AutonomousAction[] = [
  {
    domain: 'Finance',
    time: '06:42',
    body: 'Mwikila reconciled 38 auto-debits and queued 2 retries for today.',
  },
  {
    domain: 'Maintenance',
    time: '05:18',
    body: 'Mwikila dispatched 12 work orders to 4 trusted vendors overnight.',
  },
  {
    domain: 'Leasing',
    time: '04:18',
    body: 'Mwikila approved 6 same-terms renewals within your policy envelope.',
  },
  {
    domain: 'Communications',
    time: '03:45',
    body: 'Mwikila replied to 23 tenant WhatsApp threads and logged 4 for your read-through.',
  },
];

/* ──────────────────────────────  Page  ────────────────────────────── */

export default function ManagerHomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 sm:py-12">
        {/* Good-morning greeting */}
        <header className="max-w-2xl">
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-signal-500">
            Monday · 22 April
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
            Good morning, {OPERATOR_NAME}.
          </h1>
          <p className="mt-3 text-base leading-relaxed text-neutral-500 sm:text-lg">
            Mwikila handled{' '}
            <span className="tabular-nums text-foreground">
              {OVERNIGHT_ACTIONS}
            </span>{' '}
            actions overnight.{' '}
            <span className="text-foreground">3 decisions need you.</span>
          </p>
        </header>

        {/* Morning briefing hero */}
        <Link
          href="/briefing"
          className="group mt-8 flex flex-col items-start gap-5 rounded-2xl border border-signal-500/30 bg-signal-500/[0.04] p-6 transition-all duration-base ease-out hover:border-signal-500/60 hover:bg-signal-500/[0.07] sm:flex-row sm:items-center sm:gap-6 sm:p-8"
          aria-label="Open morning briefing"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-signal-500/10 ring-1 ring-signal-500/20 sm:h-16 sm:w-16">
            <Logomark size={36} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[0.68rem] uppercase tracking-widest text-signal-500">
              7am briefing · ready
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-medium leading-tight tracking-tight sm:text-3xl">
              Open your morning briefing
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-neutral-500 sm:text-base">
              Overnight actions, the three decisions waiting on you, portfolio
              health, and tenant sentiment — in a 60-second read.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start rounded-md bg-signal-500 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform duration-fast ease-out group-hover:translate-x-0.5 sm:self-center">
            Continue
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </Link>

        {/* Action tiles */}
        <section className="mt-10">
          <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
            Needs your attention
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {ACTION_TILES.map((tile) => (
              <ActionTileCard key={tile.label} tile={tile} />
            ))}
          </div>
        </section>

        {/* Two-column split: recent actions + autonomy */}
        <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:gap-8">
          {/* Recent autonomous actions */}
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
                Latest autonomous actions
              </h2>
              <Link
                href="/briefing#overnight"
                className="flex items-center gap-1 text-xs font-medium text-neutral-500 transition-colors duration-fast hover:text-foreground"
              >
                All 148
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <ol className="mt-4 space-y-1.5">
              {RECENT_ACTIONS.map((action, i) => (
                <ActionRow key={i} action={action} />
              ))}
            </ol>
          </div>

          {/* Autonomy level */}
          <aside>
            <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
              Autonomy
            </h2>
            <div className="mt-4 rounded-xl border border-border bg-surface-raised p-5">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-signal-500" />
                <span className="inline-flex items-center rounded-full bg-signal-500/10 px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-widest text-signal-500 tabular-nums">
                  Level L3
                </span>
              </div>
              <p className="mt-3 font-display text-2xl font-medium leading-tight tracking-tight">
                Act on most
              </p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                Mwikila runs the portfolio. You see exceptions only.{' '}
                <span className="tabular-nums text-foreground">7</span> red-line
                actions still require your approval.
              </p>
              <Link
                href="/autonomy"
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-signal-500 transition-colors duration-fast hover:text-signal-400"
              >
                Tune policy
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
              Today · Nairobi · <span className="tabular-nums">07:04</span>
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[0.68rem] text-neutral-500">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span>All systems operational</span>
          </div>
        </footer>
      </div>
    </div>
  );
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
          <span className="font-mono text-[0.68rem] text-neutral-500">
            <Clock className="mr-1 inline h-2.5 w-2.5" />
            <span className="tabular-nums">{action.time}</span>
          </span>
        </div>
        <p className="mt-0.5 text-sm leading-relaxed text-foreground">
          {action.body}
        </p>
      </div>
    </li>
  );
}
