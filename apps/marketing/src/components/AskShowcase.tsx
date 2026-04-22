import { ArrowRight, MessageSquare, Radio, ShieldCheck, Sparkles } from 'lucide-react';

/**
 * AskShowcase — "Talk to your company" / "Talk to the industry".
 *
 * Shows the Central Intelligence product as the two symmetric surfaces
 * it ships as:
 *
 *   - Tenant scope: the estate itself speaking in the first person
 *   - Platform scope: the industry speaking in observer voice
 *
 * This is the highest-leverage feature in the stack — and the one the
 * marketing site needs to name directly instead of dancing around it.
 * We render a pair of chat-transcript mocks side by side with the real
 * token system, so visitors see what it looks and feels like before
 * they ever book a demo.
 *
 * No interactive state here — this is display copy. The live agent
 * UI lives inside the product itself (/ask in estate-manager-app,
 * /ask in admin-platform-portal).
 */
export function AskShowcase() {
  return (
    <section
      className="relative mx-auto max-w-7xl px-6 pb-24 pt-4 lg:px-8"
      aria-labelledby="ask-heading"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          06 · The Central Intelligence
        </p>
        <h2
          id="ask-heading"
          className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl"
        >
          Talk to your company.
          <br className="hidden sm:block" />
          <span className="italic text-signal-500"> It talks back.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-[58ch] text-lg leading-relaxed text-neutral-500">
          Not a chatbot bolted on the side. The organization itself speaks in
          the first person, grounded in its own knowledge graph, with tool-use,
          extended thinking, streaming plans, and every citation clickable.
        </p>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        <TranscriptCard
          scopeLabel="Tenant scope"
          scopeIcon={MessageSquare}
          title="I am the estate."
          subtitle="First-person Head of Estates · grounded in your graph"
          question="Which vendors are my weak points this quarter?"
          plan={[
            'Query vendor performance over the last 90 days',
            'Find reopens within 30 days of completion',
            'Rank by deterioration vs. tenant count affected',
          ]}
          answer={
            <>
              Three vendors are drifting.{' '}
              <Citation label="Mwangi Plumbing" /> reopened 3 of the last 8
              jobs; that&apos;s a{' '}
              <span className="text-signal-500">+18pp</span> deterioration on
              their 90-day baseline. Worth rotating before the next two
              blocks cycle through. Two others are tracking down more
              gradually — I can show you the ranking.
            </>
          }
          cites={3}
        />

        <TranscriptCard
          scopeLabel="Platform scope"
          scopeIcon={Radio}
          title="I am the industry."
          subtitle="Observer voice · differentially-private aggregates · never a single tenant"
          question="Where is vendor reopen rate degrading?"
          plan={[
            'Run DP-aggregated vendor reopen rate by jurisdiction',
            'Reserve platform ε · Laplace mechanism',
            'Filter slices below k-anonymity threshold',
          ]}
          answer={
            <>
              Across the network, vendor reopen rate is{' '}
              <span className="text-signal-500">4.2pp higher</span> in Nairobi
              Class-B than elsewhere in the region, with{' '}
              <Citation label="a 90% conformal band of 3.1 – 5.4pp" />. The
              pattern concentrates on fixtures plumbing in buildings over
              30&nbsp;years old. 14 tenants contributed to this slice.
            </>
          }
          cites={1}
          privacyCost="ε = 0.5"
        />
      </div>

      <ul className="mt-10 grid gap-5 rounded-xl border border-border bg-surface p-6 md:grid-cols-3">
        {[
          {
            icon: Sparkles,
            title: 'Grounded answers only',
            body: 'Every claim cites a graph node, a forecast id, a statute ref, an audit entry, or a platform aggregate. If there is no tool output, the agent says so.',
          },
          {
            icon: ShieldCheck,
            title: 'Audit chain on every turn',
            body: 'Plans, tool calls, citations, artifacts, errors — all appended to the cryptographic chain with prev-hash ↔ this-hash links. User content is hashed, not stored.',
          },
          {
            icon: ArrowRight,
            title: 'Tool-using, not template-reading',
            body: 'Queries the knowledge graph, runs a forecast, searches docs, reads the audit log, renders an artifact. Streams plan and thoughts so you see the reasoning.',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.title} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-signal-500/25 bg-signal-500/5 text-signal-500">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-display text-base font-medium tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                  {item.body}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ─────────────────────── TranscriptCard ─────────────────────── */

function TranscriptCard({
  scopeLabel,
  scopeIcon: ScopeIcon,
  title,
  subtitle,
  question,
  plan,
  answer,
  cites,
  privacyCost,
}: {
  readonly scopeLabel: string;
  readonly scopeIcon: React.ComponentType<{ className?: string }>;
  readonly title: string;
  readonly subtitle: string;
  readonly question: string;
  readonly plan: ReadonlyArray<string>;
  readonly answer: React.ReactNode;
  readonly cites: number;
  readonly privacyCost?: string;
}) {
  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-widest text-signal-500">
            <ScopeIcon className="h-3 w-3" />
            {scopeLabel}
          </p>
          <h3 className="mt-2 font-display text-2xl font-medium tracking-tight">
            {title}
          </h3>
          <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
        </div>
        {privacyCost && (
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[0.62rem] text-neutral-500">
            {privacyCost}
          </span>
        )}
      </header>

      <div className="rounded-xl border border-border bg-background p-4">
        <p className="font-mono text-[0.62rem] uppercase tracking-widest text-neutral-500">
          You asked
        </p>
        <p className="mt-1 text-[0.95rem] font-medium text-foreground">
          {question}
        </p>
      </div>

      <div className="rounded-xl border border-signal-500/20 bg-signal-500/[0.04] p-4">
        <p className="font-mono text-[0.62rem] uppercase tracking-widest text-signal-500">
          Plan · streaming
        </p>
        <ol className="mt-2 space-y-1">
          {plan.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-[0.8rem] text-foreground">
              <span className="mt-0.5 font-mono text-[0.6rem] text-signal-500 tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="font-mono text-[0.62rem] uppercase tracking-widest text-neutral-500">
          Answer
        </p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground">
          {answer}
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-widest text-neutral-500">
          <ShieldCheck className="h-3 w-3 text-signal-500" />
          {cites} citation{cites === 1 ? '' : 's'} · on the chain
        </p>
      </div>
    </article>
  );
}

function Citation({ label }: { readonly label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 border-b border-dotted border-signal-500/50 text-signal-500">
      {label}
      <sup className="font-mono text-[0.58rem]">[1]</sup>
    </span>
  );
}
