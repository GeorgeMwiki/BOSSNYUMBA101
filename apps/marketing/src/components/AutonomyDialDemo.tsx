'use client';

import { useState } from 'react';
import { Gauge, LockKeyhole, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';

/**
 * AutonomyDialDemo — interactive 0-4 autonomy slider.
 *
 * Shows what Mr. Mwikila can do on your authority at each autonomy
 * level. The grid below the dial reshades itself as the user drags.
 * The copy is deliberately plain and direct — this is where we earn
 * trust by saying exactly what the brain does vs. doesn't do.
 */
export function AutonomyDialDemo() {
  const [level, setLevel] = useState(2);

  const capabilities = [
    { id: 'reminders',   label: 'Send rent reminders',          minLevel: 1 },
    { id: 'maintenance', label: 'Dispatch maintenance',          minLevel: 2 },
    { id: 'compliance',  label: 'Draft compliance notices',      minLevel: 2 },
    { id: 'renewals',    label: 'Approve same-terms renewals',   minLevel: 3 },
    { id: 'waivers',     label: 'Small-value rent waivers',      minLevel: 3 },
    { id: 'payouts',     label: 'Release vendor payouts',        minLevel: 3 },
    { id: 'eviction',    label: 'Draft eviction notices',        minLevel: 4 },
    { id: 'tribunal',    label: 'File at tribunal',              minLevel: 99 },
    { id: 'terminate',   label: 'Auto-send legal notices',       minLevel: 99 },
  ];

  const levelName = ['Observe only', 'Assist', 'Act on low-stakes', 'Act on most', 'Act on all permitted'][level];
  const levelBlurb = [
    'Mr. Mwikila watches but never acts. You see drafts; you send them.',
    'Mwikila drafts every response for your review. No outbound actions.',
    'Routine actions ship autonomously. Anything financial or legal routes to you.',
    'Mwikila runs the portfolio. You see exceptions only.',
    'Maximum autonomy inside your policy. The 7 red-line actions still require approval.',
  ][level];

  return (
    <section className="relative mx-auto max-w-7xl px-6 pb-24 pt-4 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          02 · Autonomy, On Your Terms
        </p>
        <h2 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Delegate at your own pace.
        </h2>
        <p className="mx-auto mt-5 max-w-[52ch] text-lg leading-relaxed text-neutral-500">
          Five autonomy levels. Ten domains. Every decision passes a policy
          chokepoint. Seven actions never auto-execute, no matter what.
        </p>
      </div>

      <div className="mt-14 grid gap-8 rounded-2xl border border-border bg-surface p-8 lg:grid-cols-[1fr_1.5fr] lg:p-10">
        {/* Left: dial */}
        <div className="flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-signal-500" />
              <span className="font-mono text-xs uppercase tracking-widest text-neutral-500">
                Autonomy level
              </span>
            </div>
            <p className="mt-2 font-mono text-5xl font-medium tabular-nums leading-none">0{level}</p>
            <p className="mt-3 font-display text-2xl font-medium leading-tight tracking-tight">{levelName}</p>
            <p className="mt-2 text-sm text-neutral-500">{levelBlurb}</p>
          </div>

          {/* Slider */}
          <div className="mt-8">
            <input
              type="range"
              min={0}
              max={4}
              step={1}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="accent-signal-500 w-full"
              aria-label="Autonomy level"
            />
            <div className="mt-2 grid grid-cols-5 font-mono text-[0.65rem] uppercase tracking-widest text-neutral-500">
              <span>Observe</span>
              <span>Assist</span>
              <span>Act · low</span>
              <span>Act · most</span>
              <span>Max</span>
            </div>
          </div>

          {/* Red-line guarantee */}
          <div className="mt-6 rounded-lg border border-signal-500/20 bg-signal-500/5 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-signal-500" />
              <span className="font-mono text-[0.68rem] uppercase tracking-widest text-signal-500">
                Red-line guarantee
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              Mr. Mwikila never auto-sends legal notices, never auto-files at
              tribunal, and never auto-terminates a tenancy. Not at any
              autonomy level. Not ever.
            </p>
          </div>
        </div>

        {/* Right: capabilities grid */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {capabilities.map((c) => {
            const redLine = c.minLevel === 99;
            const allowed = level >= c.minLevel && !redLine;
            return (
              <div
                key={c.id}
                className={[
                  'flex items-center gap-3 rounded-lg border p-3.5 transition-all duration-base ease-out',
                  redLine && 'border-danger/30 bg-danger-subtle/20',
                  allowed && !redLine && 'border-signal-500/40 bg-signal-500/5',
                  !allowed && !redLine && 'border-border bg-surface-raised opacity-60',
                ].filter(Boolean).join(' ')}
              >
                <span
                  className={[
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                    redLine && 'bg-danger/15 text-danger',
                    allowed && !redLine && 'bg-signal-500/15 text-signal-500',
                    !allowed && !redLine && 'bg-neutral-200/40 text-neutral-500',
                  ].filter(Boolean).join(' ')}
                >
                  {redLine ? (
                    <LockKeyhole className="h-4 w-4" />
                  ) : allowed ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <UsersRound className="h-4 w-4" />
                  )}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{c.label}</p>
                  <p className="mt-0.5 font-mono text-[0.65rem] uppercase tracking-widest text-neutral-500">
                    {redLine
                      ? 'Red-line · never autonomous'
                      : allowed
                      ? 'Autonomous at this level'
                      : `Unlocks at L${c.minLevel}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
