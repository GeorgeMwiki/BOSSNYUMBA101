'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

import { SectionSkeleton } from '@/components/SectionSkeleton';
import { LazyVisible } from '@/components/LazyVisible';
import { FrontierBanner } from '@/components/sections/FrontierBanner';
import { ProblemSolution } from '@/components/sections/ProblemSolution';
import { WhoWeServeSection } from '@/components/sections/WhoWeServeSection';
import type { Locale } from '@/lib/i18n';

/**
 * HomePage — carbon copy of the upstream fork's HomePage pattern adapted to
 * BossNyumba's real-estate narrative. All copy is catalog-driven
 * (`getMessages(locale).home.*`) via the section components; the page is a
 * thin composition, never a hardcoded-string carrier.
 *
 * Eager above-fold:
 *   - FrontierBanner       (home.frontierBanner)
 *   - ProblemSolution      (home.problemSolution)
 *   - WhoWeServeSection    (the full real-estate-business spectrum)
 *
 * Lazy below-fold (Suspense + IntersectionObserver gate):
 *   - EcosystemSection · UniversalAccessSection · MwikilaModesSection
 *   - InteractiveModesSection · BentoGrid · PlatformShowcaseSection
 *   - InsightsAndScaleSection · RoadmapCTASection
 */

const EcosystemSection = dynamic(
  () =>
    import('@/components/sections/EcosystemSection').then((m) => ({
      default: m.EcosystemSection,
    })),
  { loading: () => <SectionSkeleton minHeight={520} cards={3} /> }
);

const UniversalAccessSection = dynamic(
  () =>
    import('@/components/sections/UniversalAccessSection').then((m) => ({
      default: m.UniversalAccessSection,
    })),
  { loading: () => <SectionSkeleton minHeight={480} cards={3} /> }
);

const MwikilaModesSection = dynamic(
  () =>
    import('@/components/sections/MwikilaModesSection').then((m) => ({
      default: m.MwikilaModesSection,
    })),
  { loading: () => <SectionSkeleton minHeight={560} cards={3} /> }
);

const InteractiveModesSection = dynamic(
  () =>
    import('@/components/sections/InteractiveModesSection').then((m) => ({
      default: m.InteractiveModesSection,
    })),
  { loading: () => <SectionSkeleton minHeight={520} cards={3} /> }
);

const BentoGrid = dynamic(
  () =>
    import('@/components/sections/BentoGrid').then((m) => ({
      default: m.BentoGrid,
    })),
  { loading: () => <SectionSkeleton minHeight={420} cards={4} /> }
);

const PlatformShowcaseSection = dynamic(
  () =>
    import('@/components/sections/PlatformShowcaseSection').then((m) => ({
      default: m.PlatformShowcaseSection,
    })),
  { loading: () => <SectionSkeleton minHeight={480} cards={3} /> }
);

const InsightsAndScaleSection = dynamic(
  () =>
    import('@/components/sections/InsightsAndScaleSection').then((m) => ({
      default: m.InsightsAndScaleSection,
    })),
  { loading: () => <SectionSkeleton minHeight={480} cards={3} /> }
);

const RoadmapCTASection = dynamic(
  () =>
    import('@/components/sections/RoadmapCTASection').then((m) => ({
      default: m.RoadmapCTASection,
    })),
  { loading: () => <SectionSkeleton minHeight={480} cards={4} /> }
);

export interface HomePageProps {
  readonly locale: Locale;
}

export function HomePage({ locale }: HomePageProps) {
  return (
    <div className="overflow-x-hidden">
      {/* ABOVE-FOLD — catalog-driven, eager */}
      <FrontierBanner locale={locale} />
      <ProblemSolution locale={locale} />

      {/* WHO WE SERVE — the full real-estate-business spectrum (eager: key
          message + audience links should be in the SSR HTML for SEO) */}
      <WhoWeServeSection locale={locale} />

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
