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
    blurb: 'Monitors rent comps, regulatory changes, and neighbourhood signals. Drafts proposals when the market drifts.',
    icon: LineChart,
  },
  {
    title: 'Sentiment monitor',
    blurb: 'Reads every tenant message across WhatsApp, SMS, email, and in-app. Flags hardship, frustration, churn risk.',
    icon: HeartPulse,
  },
  {
    title: 'Multimodal inspection',
    blurb: 'Photos, floorplans, inspection reports, receipts. Extracts line-items, flags anomalies, dates everything.',
    icon: Microscope,
  },
  {
    title: 'Polyglot support',
    blurb: 'Replies to tenants in their language: English, Swahili, Arabic, French, German, Korean, Japanese, Portuguese, Spanish, Chinese, Hindi.',
    icon: Globe2,
  },
  {
    title: 'Predictive interventions',
    blurb: 'Spots default risk before the miss. Offers payment plans before arrears become legal problems.',
    icon: Brain,
  },
  {
    title: 'Policy simulator',
    blurb: 'Try a policy change in shadow mode. See what Mwikila would have done differently last month before granting the new rule.',
    icon: Gavel,
  },
  {
    title: 'Natural-language query',
    blurb: '"Who is 30+ days late and has no payment plan?" Answered in seconds, with a verifiable audit trail.',
    icon: FileSearch,
  },
  {
    title: 'Pattern mining',
    blurb: 'Finds the three maintenance problems most likely to repeat this quarter. Learns from your history, not a generic model.',
    icon: Sparkles,
  },
  {
    title: 'Voice persona DNA',
    blurb: 'Your brand voice, pinned. Head-of-estates, owner-liaison, tenant-facing, vendor-coordination — six locked personae, zero drift.',
    icon: Mic,
  },
  {
    title: 'Estate glossary',
    blurb: '2,000+ curated terms across 9 categories, 11 languages, with statute citations. Grounds every legal draft.',
    icon: BookOpenText,
  },
  {
    title: 'Extended thinking',
    blurb: 'High-stakes decisions trigger deliberate reasoning with a logged thinking trace for compliance review.',
    icon: Scale,
  },
  {
    title: 'Differentially-private memory',
    blurb: 'Patterns learned across the whole network inform your defaults, with mathematically-proven privacy between tenants.',
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
