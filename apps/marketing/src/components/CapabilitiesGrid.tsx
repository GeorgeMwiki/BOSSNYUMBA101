import {
  Archive,
  Banknote,
  BookOpenText,
  Brain,
  FileSearch,
  Gavel,
  Globe2,
  Headphones,
  HeartPulse,
  LineChart,
  Mic,
  Microscope,
  Scale,
  ShieldAlert,
  Sparkles,
  UsersRound,
} from 'lucide-react';

type Capability = {
  readonly title: string;
  readonly blurb: string;
  readonly icon: React.ComponentType<{ className?: string }>;
};

const CAPABILITIES: readonly Capability[] = [
  {
    title: 'Market surveillance',
    blurb:
      'Tracks rent comps, statute changes, and neighbourhood signals. Drafts a grounded proposal the moment your position drifts — routed through the proactive-loop with a confidence interval, not a vibe.',
    icon: LineChart,
  },
  {
    title: 'Sentiment monitor',
    blurb:
      'Scores every tenant message across WhatsApp, SMS, email, and in-app against the pinned voice profile. Flags hardship, frustration, and churn risk before they become an incident.',
    icon: HeartPulse,
  },
  {
    title: 'Multimodal inspection',
    blurb:
      'Photos, floorplans, inspection reports, invoices, title deeds. Extracts line-items, flags anomalies, dates everything, and links findings to the unit node in your graph.',
    icon: Microscope,
  },
  {
    title: '11-language support',
    blurb:
      'English, Swahili, Arabic, French, German, Korean, Japanese, Portuguese, Spanish, Mandarin, Hindi. A multi-script regression gate (13 baseline fixtures) blocks quality drops before they reach a tenant.',
    icon: Globe2,
  },
  {
    title: 'Forecasts with intervals',
    blurb:
      'Temporal Graph Networks per portfolio + conformal prediction intervals. Every forecast ships with a 90% coverage band (not a point guess) and a driver narrative that names the three biggest contributors.',
    icon: Brain,
  },
  {
    title: 'Policy simulator · shadow mode',
    blurb:
      'Run a policy change in dry-run for 14 days. See what Mwikila would have done differently — side by side with your real ops — before you grant the new rule real authority.',
    icon: Gavel,
  },
  {
    title: 'Ask your company',
    blurb:
      '"Who is 30+ days late with no payment plan?" A first-person agent answers from your own knowledge graph with tool calls, cited nodes, and an expandable reasoning trace. Every turn on the audit chain.',
    icon: FileSearch,
  },
  {
    title: 'Pattern mining',
    blurb:
      'Finds the three maintenance modes most likely to recur this quarter across your portfolio. Learns from your history, not a generic model. Surfaces in the briefing as a proactive proposal.',
    icon: Sparkles,
  },
  {
    title: 'Voice persona DNA',
    blurb:
      'Six pinned personae: head-of-estates, owner-liaison, tenant, vendor, regulator, applicant. Tone, pace, register, taboos, code-switching rules — all frozen at module load and drift-detected.',
    icon: Mic,
  },
  {
    title: 'Estate glossary',
    blurb:
      '600+ curated terms across tenancy · finance · compliance · maintenance · legal · HR · insurance · marketing · procurement. Statute citations (Cap 301, BGB §535-578, 借地借家法, etc.) ground every legal draft.',
    icon: BookOpenText,
  },
  {
    title: 'Extended thinking',
    blurb:
      'Evictions · terminations · tribunal filings · rent-waiver decisions engage deliberate reasoning with a logged thinking trace. 7 red-line actions never auto-execute, period — at any autonomy level.',
    icon: Scale,
  },
  {
    title: 'Differentially-private network',
    blurb:
      'Patterns learned across every tenant inform your defaults, with mathematically-proven privacy (Laplace · Gaussian · Dwork advanced composition). Reserve-before-read; k-anonymity gate; audited every debit.',
    icon: ShieldAlert,
  },
];

export function CapabilitiesGrid() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 pb-24 pt-4 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          03 · The Estate Brain
        </p>
        <h2 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Twelve capabilities, one calm operator.
        </h2>
        <p className="mx-auto mt-5 max-w-[54ch] text-lg leading-relaxed text-neutral-500">
          Each capability is a live system, not a feature page. Every decision
          passes through policy, grants, and an append-only audit trail.
        </p>
      </div>

      <ul className="mt-14 grid gap-px rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITIES.map((c, i) => {
          const Icon = c.icon;
          const isCorner = (n: number) => n === 0 || n === 2 || n === 9 || n === 11;
          return (
            <li
              key={c.title}
              className={[
                'group relative flex flex-col gap-4 bg-surface p-7 transition-colors duration-fast hover:bg-surface-raised',
                isCorner(i) && 'lg:first:rounded-tl-2xl',
              ].join(' ')}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-signal-500/25 bg-signal-500/5 text-signal-500 transition-all duration-base ease-out group-hover:border-signal-500/50 group-hover:shadow-[0_0_24px_-8px_hsl(var(--signal-500)/0.6)]">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-xl font-medium tracking-tight">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{c.blurb}</p>
              </div>
              <span className="absolute right-5 top-5 font-mono text-[0.65rem] uppercase tracking-widest text-neutral-600">
                {String(i + 1).padStart(2, '0')}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
