'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { CheckCircle2, Sparkles, TrendingUp } from 'lucide-react';

import { SectionSkeleton } from '@/components/SectionSkeleton';
import { LazyVisible } from '@/components/LazyVisible';
import type { Locale } from '@/lib/i18n';

/**
 * HomePage — carbon copy of LitFin's HomePage pattern
 * (LITFIN_PATH/src/components/home/HomePage.tsx) adapted to
 * BossNyumba's real-estate narrative.
 *
 * Eager above-fold of HomePage:
 *   - Frontier banner
 *   - Why-an-estate-OS problem/solution duo
 *
 * Lazy below-fold (Suspense + IntersectionObserver gate):
 *   - EcosystemSection
 *   - UniversalAccessSection
 *   - MwikilaModesSection (BN's AI-officer-tabs equivalent)
 *   - InteractiveModesSection
 *   - BentoGrid
 *   - PlatformShowcaseSection
 *   - InsightsAndScaleSection
 *   - RoadmapCTASection
 */

const EcosystemSection = dynamic(
  () =>
    import('@/components/sections/EcosystemSection').then((m) => ({
      default: m.EcosystemSection,
    })),
  { loading: () => <SectionSkeleton minHeight={520} cards={3} /> },
);

const UniversalAccessSection = dynamic(
  () =>
    import('@/components/sections/UniversalAccessSection').then((m) => ({
      default: m.UniversalAccessSection,
    })),
  { loading: () => <SectionSkeleton minHeight={480} cards={3} /> },
);

const MwikilaModesSection = dynamic(
  () =>
    import('@/components/sections/MwikilaModesSection').then((m) => ({
      default: m.MwikilaModesSection,
    })),
  { loading: () => <SectionSkeleton minHeight={560} cards={3} /> },
);

const InteractiveModesSection = dynamic(
  () =>
    import('@/components/sections/InteractiveModesSection').then((m) => ({
      default: m.InteractiveModesSection,
    })),
  { loading: () => <SectionSkeleton minHeight={520} cards={3} /> },
);

const BentoGrid = dynamic(
  () =>
    import('@/components/sections/BentoGrid').then((m) => ({
      default: m.BentoGrid,
    })),
  { loading: () => <SectionSkeleton minHeight={420} cards={4} /> },
);

const PlatformShowcaseSection = dynamic(
  () =>
    import('@/components/sections/PlatformShowcaseSection').then((m) => ({
      default: m.PlatformShowcaseSection,
    })),
  { loading: () => <SectionSkeleton minHeight={480} cards={3} /> },
);

const InsightsAndScaleSection = dynamic(
  () =>
    import('@/components/sections/InsightsAndScaleSection').then((m) => ({
      default: m.InsightsAndScaleSection,
    })),
  { loading: () => <SectionSkeleton minHeight={480} cards={3} /> },
);

const RoadmapCTASection = dynamic(
  () =>
    import('@/components/sections/RoadmapCTASection').then((m) => ({
      default: m.RoadmapCTASection,
    })),
  { loading: () => <SectionSkeleton minHeight={480} cards={4} /> },
);

const PROBLEM_ITEMS = [
  {
    title: 'Disconnected operations',
    desc: 'Leases in Word, rent in Excel, maintenance in WhatsApp, tax in a folder. Every owner re-stitches the same flow every month.',
  },
  {
    title: 'Cash-flow blind spots',
    desc: 'You only see what was paid after the fact. There is no early-warning that Unit 5 is about to default.',
  },
  {
    title: 'Compliance overhead',
    desc: 'NHC, BRELA, TRA each ask for the same data in different shapes. Owners pay accountants to assemble what should already be there.',
  },
  {
    title: 'Tenant invisibility',
    desc: 'Most tenants are good. A few are not. Without history, every screening starts from zero. Bad tenants cost the system.',
  },
] as const;

const SOLUTION_ITEMS = [
  {
    title: 'One running estate brain',
    desc: 'Lease, rent, maintenance, treasury, compliance, holdings, asset register — one system, one source of truth. Mr. Mwikila is always aware of the full picture.',
  },
  {
    title: 'Every payment, every promise, audited',
    desc: 'Hash-chained ledger. Reversible only by counter-entry. Bank-grade reconciliation. Regulators can verify any line without you in the loop.',
  },
  {
    title: 'AI that asks permission correctly',
    desc: 'Mr. Mwikila is a calm partner — he drafts the renewal, the eviction notice, the BRELA filing, and waits for you to sign. He never acts on his own authority.',
  },
  {
    title: 'Built for Tanzania first',
    desc: 'M-Pesa, Airtel Money, Swahili-first. Then Kenya, Uganda, the rest of East Africa. Same operating system, jurisdiction-aware.',
  },
] as const;

export interface HomePageProps {
  readonly locale: Locale;
}

export function HomePage({ locale }: HomePageProps) {
  return (
    <div className="overflow-x-hidden">
      {/* FRONTIER BANNER (above-fold) */}
      <section className="relative border-y border-border bg-primary/5 py-10">
        <div className="mx-auto max-w-7xl px-5">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <p className="text-xl tracking-[-0.015em] text-foreground sm:text-2xl font-semibold">
              Property OS is the frontier.{' '}
              <span className="bg-[linear-gradient(135deg,hsl(36_86%_64%)_0%,hsl(24_72%_50%)_50%,hsl(14_62%_28%)_100%)] bg-clip-text text-transparent">
                BossNyumba is the operating system.
              </span>
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Built for a market where the workflows themselves have not been
              digitised yet. Not a CRM. Not a spreadsheet. A brain that runs the
              estate.
            </p>
          </motion.div>
        </div>
      </section>

      {/* WHY AN ESTATE OS — eager */}
      <section className="bg-card py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mx-auto mb-14 max-w-3xl text-center"
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
              The gap we are closing
            </span>
            <h2 className="mt-3 text-4xl font-bold tracking-[-0.025em] text-foreground md:text-5xl">
              Property management,{' '}
              <span className="bg-[linear-gradient(135deg,hsl(36_86%_64%)_0%,hsl(24_72%_50%)_50%,hsl(14_62%_28%)_100%)] bg-clip-text text-transparent">
                from sprawl to system.
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              Most landlords run their estate the same way they did 30 years
              ago. The tools changed name; the workflow did not.
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-lg font-medium text-foreground">
              BossNyumba is the operating system that finally puts the entire
              estate — every lease, every tenant, every shilling — under one
              brain.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex h-full flex-col rounded-lg border border-border bg-background p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10">
                  <TrendingUp className="h-5 w-5 text-destructive" strokeWidth={1.75} />
                </div>
                <h3 className="text-xl font-semibold tracking-[-0.015em] text-foreground">
                  The problem today
                </h3>
              </div>
              <div className="space-y-5">
                {PROBLEM_ITEMS.map((item, i) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-[11px] font-semibold text-destructive tabular-nums">
                      {i + 1}
                    </span>
                    <div>
                      <span className="text-sm font-semibold text-foreground">
                        {item.title}
                      </span>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex h-full flex-col rounded-lg border border-border bg-background p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.75} />
                </div>
                <h3 className="text-xl font-semibold tracking-[-0.015em] text-foreground">
                  What BossNyumba does
                </h3>
              </div>
              <div className="space-y-5">
                {SOLUTION_ITEMS.map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} />
                    <div>
                      <span className="text-sm font-semibold text-foreground">
                        {item.title}
                      </span>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BELOW-FOLD — code-split + LazyVisible-gated */}
      <Suspense fallback={<SectionSkeleton minHeight={520} cards={3} />}>
        <EcosystemSection locale={locale} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton minHeight={480} cards={3} />}>
        <UniversalAccessSection locale={locale} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton minHeight={560} cards={3} />}>
        <MwikilaModesSection locale={locale} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton minHeight={520} cards={3} />}>
        <InteractiveModesSection locale={locale} />
      </Suspense>

      <LazyVisible placeholderClassName="min-h-[420px]">
        <Suspense fallback={<SectionSkeleton minHeight={420} cards={4} />}>
          <BentoGrid locale={locale} />
        </Suspense>
      </LazyVisible>

      <LazyVisible placeholderClassName="min-h-[480px]">
        <Suspense fallback={<SectionSkeleton minHeight={480} cards={3} />}>
          <PlatformShowcaseSection locale={locale} />
        </Suspense>
      </LazyVisible>

      <LazyVisible placeholderClassName="min-h-[480px]">
        <Suspense fallback={<SectionSkeleton minHeight={480} cards={3} />}>
          <InsightsAndScaleSection locale={locale} />
        </Suspense>
      </LazyVisible>

      <LazyVisible placeholderClassName="min-h-[480px]">
        <Suspense fallback={<SectionSkeleton minHeight={480} cards={4} />}>
          <RoadmapCTASection locale={locale} />
        </Suspense>
      </LazyVisible>
    </div>
  );
}
