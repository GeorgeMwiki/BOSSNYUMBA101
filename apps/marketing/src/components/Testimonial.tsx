import { Quote } from 'lucide-react';

/**
 * Testimonial — one quote, large. Netflix review-card density, not
 * a 12-logo vanity wall. Quote is attributed to a role + sector, not
 * "— Head of XYZ at ABC" with a stock headshot.
 */
export function Testimonial() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 pb-24 pt-4 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-10 sm:p-16">
        {/* Faint amber aurora behind the quote */}
        <div
          className="pointer-events-none absolute -left-20 -top-32 h-96 w-96 rounded-full bg-signal-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-20 h-80 w-80 rounded-full bg-signal-700/8 blur-3xl"
          aria-hidden="true"
        />

        <Quote className="relative h-10 w-10 text-signal-500" aria-hidden="true" />

        <blockquote className="relative mt-8">
          <p className="font-display text-2xl font-normal leading-snug tracking-tight text-balance text-foreground sm:text-3xl lg:text-4xl">
            We used to have seventeen spreadsheets, three property-management
            systems, and one exhausted head of estates. Boss Nyumba replaced
            fifteen of the spreadsheets, two of the PMS instances, and
            <span className="text-signal-500"> gave my morning back.</span>
          </p>
        </blockquote>

        <div className="relative mt-10 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-signal-500/30 bg-surface-raised font-display text-lg font-medium text-signal-500">
            JM
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Head of Estates</p>
            <p className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
              Institutional landlord · 4,200 units across 3 countries
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
