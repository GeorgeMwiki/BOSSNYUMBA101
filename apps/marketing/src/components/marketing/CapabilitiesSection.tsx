'use client';

import { Brain, ShieldCheck, Network, LineChart, Mic, Plug } from 'lucide-react';

import { Logomark } from '@bossnyumba/design-system';
import { getMessages, type Locale } from '@/lib/i18n';

/**
 * CapabilitiesSection — the homepage "platform" capability grid. Catalog-driven
 * (`getMessages(locale).capabilities`): the copy + the six card name/descriptions
 * live in the i18n catalog, never hardcoded inline. Icons stay in code (they are
 * components, not copy) and pair with `capabilities.cards[i]` by index.
 */

function cn(...classes: ReadonlyArray<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

// Platform capability icons, in catalog-card order (capabilities.cards[i]).
const CARD_ICONS = [Brain, Network, LineChart, ShieldCheck, Mic, Plug] as const;

interface CapabilitiesSectionProps {
  readonly locale: Locale;
  readonly className?: string;
}

export function CapabilitiesSection({ locale, className }: CapabilitiesSectionProps) {
  const t = getMessages(locale).capabilities;

  return (
    <section
      className={cn(
        'relative isolate overflow-hidden py-16 md:py-24 px-5 border-t border-border bg-card/40',
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 -z-10 h-[480px] w-[480px] rounded-full blur-3xl opacity-20"
        style={{
          background:
            'radial-gradient(circle, hsl(var(--signal-500) / 0.35) 0%, hsl(var(--signal-600) / 0.08) 45%, transparent 75%)',
        }}
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-10 md:mb-14 flex max-w-3xl items-start gap-4">
          <Logomark size={36} variant="premium" />
          <div>
            <p className="text-meta font-semibold uppercase tracking-[0.16em] text-primary">
              {t.kicker}
            </p>
            <h2 className="mt-3 text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] text-foreground leading-[1.05]">
              {t.heading}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
              {t.sub}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {t.cards.map((cap, i) => {
            const Icon = CARD_ICONS[i] ?? Brain;
            return (
              <article
                key={cap.name}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border border-border bg-card p-5',
                  'shadow-sm',
                  'transition-[border-color,box-shadow,transform] duration-300',
                  'hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg'
                )}
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full blur-3xl',
                    'opacity-0 transition-opacity duration-500',
                    'group-hover:opacity-50'
                  )}
                  style={{
                    background:
                      'radial-gradient(circle, hsl(var(--signal-500) / 0.5) 0%, transparent 70%)',
                  }}
                />
                <div
                  className={cn(
                    'mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md',
                    'bg-primary/10 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]',
                    'transition-all duration-300',
                    'group-hover:bg-primary/20 group-hover:scale-105'
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="text-base font-semibold tracking-[-0.01em] text-foreground">
                  {cap.name}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {cap.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
