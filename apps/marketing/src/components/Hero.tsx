import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Logomark } from '@bossnyumba/design-system';

/**
 * Hero — the single most important surface on the site.
 *
 * Design intent:
 *   - Display-serif headline in Fraunces, MASSIVE (clamp 56-104px), tight
 *     tracking, text-balance. The type IS the design.
 *   - One-line subhead in the text face, neutral-400 weight, max 62ch.
 *   - Two CTAs: primary amber "Book a demo", ghost "Watch a 2-minute tour".
 *   - Ambient amber aurora behind the headline — very subtle, never an
 *     "AI glow-orb."
 *   - Trust-line of domain counters beneath the CTAs — the credibility,
 *     not vanity metrics.
 *   - A single "∎" glyph chip at the very top, replacing the generic
 *     "new product launch!" rainbow-gradient announcement bar.
 */
export function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      aria-labelledby="hero-headline"
    >
      {/* Ambient amber aurora */}
      <div className="hero-aurora" aria-hidden="true" />

      {/* Cinematic grid underlay */}
      <div
        className="absolute inset-0 cinematic-grid opacity-40"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 sm:pb-32 sm:pt-28 lg:px-8">
        {/* Announcement chip — editorial, not Intercom-style */}
        <div className="mb-10 flex justify-center">
          <Link
            href="/meaning"
            className="group inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/60 px-3 py-1 text-xs font-medium text-neutral-500 backdrop-blur transition-colors duration-fast hover:border-signal-700 hover:text-foreground"
          >
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-signal-500" aria-hidden="true" />
            <span className="tracking-wide uppercase text-[0.68rem]">Swahili</span>
            <span className="h-3 w-px bg-border" aria-hidden="true" />
            <span className="italic">BossNyumba</span>
            <span className="text-neutral-600">—</span>
            <span>head of the house</span>
            <ArrowRight className="h-3 w-3 text-neutral-500 transition-transform duration-fast group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Headline */}
        <h1
          id="hero-headline"
          className="font-display text-[clamp(2.75rem,7vw,6.5rem)] font-medium leading-[1.02] tracking-tighter text-foreground text-balance text-center"
        >
          The head of
          <br />
          the house,
          <br />
          <span className="relative inline-block">
            <span className="italic text-signal-500">amplified.</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 500 16"
              preserveAspectRatio="none"
              className="absolute left-0 right-0 -bottom-2 h-2 w-full text-signal-500/70"
            >
              <path
                d="M2 10 Q125 2 250 8 T498 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        {/* Subhead */}
        <p className="mx-auto mt-8 max-w-[62ch] text-center text-lg leading-relaxed text-neutral-500 sm:text-xl">
          BossNyumba is an autonomous AI brain for property portfolios.
          It runs finance, maintenance, compliance, leasing, legal, and seven
          more domains on your authority — with a five-level autonomy dial,
          seven red-line guardrails, a cryptographic audit chain, and a
          first-person agent you can talk to about your own company.
        </p>

        {/* Capability micro-strip */}
        <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.72rem] font-mono uppercase tracking-widest text-neutral-500">
          {[
            'Head Briefing',
            'Talk to your company',
            'Forecasts · conformal',
            'Knowledge graph',
            'Audit chain',
            'Shadow mode',
          ].map((label, i, arr) => (
            <li key={label} className="flex items-center gap-5">
              <span>{label}</span>
              {i < arr.length - 1 && (
                <span aria-hidden="true" className="hidden h-[3px] w-[3px] rounded-full bg-signal-500/70 sm:inline-block" />
              )}
            </li>
          ))}
        </ul>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/book-demo"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-md bg-signal-500 px-6 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-base ease-out hover:bg-signal-400 hover:shadow-lg active:scale-[0.98]"
          >
            Book a 20-minute demo
            <ArrowRight className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/tour"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border px-6 text-sm font-semibold text-foreground transition-colors duration-fast hover:bg-surface-raised"
          >
            Watch the 2-minute tour
          </Link>
        </div>

        {/* Trust-line */}
        <dl className="mt-20 grid grid-cols-2 gap-6 border-t border-border/60 pt-10 sm:grid-cols-4">
          {[
            { value: '232',        label: 'Jurisdictions' },
            { value: '11',         label: 'Languages' },
            { value: '10',         label: 'Autonomy domains' },
            { value: 'SOC 2 · ISO', label: 'Certifications' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-1 border-l border-border/50 pl-6 first:border-l-0 first:pl-0 sm:border-l sm:pl-6 sm:first:border-l-0 sm:first:pl-0"
            >
              <dt className="font-mono text-xs uppercase tracking-widest text-neutral-500">
                {stat.label}
              </dt>
              <dd className="font-display text-3xl font-medium leading-tight tracking-tight text-foreground tabular-nums sm:text-4xl">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* Micro footnote */}
        <p className="mt-10 flex items-center justify-center gap-2 font-mono text-[0.68rem] uppercase tracking-widest text-neutral-600">
          <Logomark size={10} className="text-signal-500" />
          <span>Calm intelligence, institutional trust</span>
        </p>
      </div>
    </section>
  );
}
