import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { type Locale } from '@/lib/i18n';
import { buildAudienceCategories, type AudienceCategoryLabels } from '@/lib/audiences';

/**
 * WhoWeServeSection — the homepage "Built for every real-estate business" band.
 *
 * BossNyumba is one operating system for the WHOLE spectrum of real-estate
 * businesses, not just the single landlord. This section makes that explicit
 * on the homepage itself (not only in the nav mega-menu): a scroller sees the
 * full audience map and self-identifies. It reuses the SAME canonical taxonomy
 * as the nav (`@/lib/audiences`), so labels/ordering/hrefs never drift.
 *
 * Locale-pure: every string resolves to the active locale only (no mixing).
 */

interface WhoWeServeCopy {
  readonly kicker: string;
  readonly headline: string;
  readonly headlineAccent: string;
  readonly subhead: string;
  readonly categories: AudienceCategoryLabels;
}

const COPY: Record<Locale, WhoWeServeCopy> = {
  en: {
    kicker: 'Who we serve',
    headline: 'Built for every',
    headlineAccent: 'real-estate business.',
    subhead:
      'From a single landlord with two flats to a national REIT, a leasing agency, a housing cooperative, a family office, a campus, or a government estate — they all run on the same calm brain. Find yours.',
    categories: {
      individuals: 'Individuals',
      operators: 'Operators',
      capital: 'Capital',
      public: 'Public',
      enterprise: 'Enterprise',
      community: 'Community',
    },
  },
  sw: {
    kicker: 'Tunaowahudumia',
    headline: 'Imejengwa kwa kila',
    headlineAccent: 'biashara ya mali.',
    subhead:
      'Kutoka mwenye nyumba binafsi mwenye vyumba viwili hadi REIT ya kitaifa, wakala wa upangishaji, ushirika wa nyumba, ofisi ya familia, chuo kikuu, au mali ya serikali — wote wanaendeshwa na ubongo mmoja tulivu. Tafuta wako.',
    categories: {
      individuals: 'Watu binafsi',
      operators: 'Waendeshaji',
      capital: 'Mtaji',
      public: 'Umma',
      enterprise: 'Mashirika',
      community: 'Jamii',
    },
  },
};

export interface WhoWeServeSectionProps {
  readonly locale: Locale;
}

export function WhoWeServeSection({ locale }: WhoWeServeSectionProps) {
  const sw = locale === 'sw';
  const copy = COPY[locale];
  const categories = buildAudienceCategories(copy.categories, sw);

  return (
    <section
      aria-labelledby="who-we-serve-heading"
      className="border-t border-border bg-background py-16 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-5">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <span className="text-meta font-semibold uppercase tracking-[0.16em] text-primary">
            {copy.kicker}
          </span>
          <h2
            id="who-we-serve-heading"
            className="mt-3 text-balance text-4xl font-bold tracking-[-0.025em] text-foreground md:text-5xl"
          >
            {copy.headline}{' '}
            <span className="bg-[linear-gradient(135deg,hsl(36_86%_64%)_0%,hsl(24_72%_50%)_50%,hsl(14_62%_28%)_100%)] bg-clip-text text-transparent">
              {copy.headlineAccent}
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {copy.subhead}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <div key={category.title}>
              <h3 className="mb-3 text-meta font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {category.title}
              </h3>
              <ul className="space-y-1.5">
                {category.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="group flex items-start gap-3 rounded-lg border border-transparent p-2.5 transition-colors duration-200 hover:border-border hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary/20">
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
                            {item.label}
                            <ArrowUpRight
                              className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                            {item.desc}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
