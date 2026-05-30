import { Nav } from '@/components/Nav';
import { Hero } from '@/components/Hero';
import { BrainClaimsBanner } from '@/components/BrainClaimsBanner';
import { TrustStrip } from '@/components/TrustStrip';
import { CapabilitiesGrid } from '@/components/CapabilitiesGrid';
import { HowItWorks } from '@/components/HowItWorks';
import { HeadBriefingDemo } from '@/components/HeadBriefingDemo';
import { AskShowcase } from '@/components/AskShowcase';
import { StatsBand } from '@/components/StatsBand';
import { AutonomyDialDemo } from '@/components/AutonomyDialDemo';
import { AuditChainSection } from '@/components/AuditChainSection';
import { LoopValidatorSection } from '@/components/LoopValidatorSection';
import { Pricing } from '@/components/Pricing';
import { Testimonial } from '@/components/Testimonial';
import { Footer } from '@/components/Footer';
import { LazyVisible } from '@/components/LazyVisible';
import { SectionSkeleton } from '@/components/SectionSkeleton';
import { StaggerReveal } from '@/components/animations/StaggerReveal';
import { FrontierBanner } from '@/components/sections/FrontierBanner';
import { ProblemSolution } from '@/components/sections/ProblemSolution';
import { EcosystemSection } from '@/components/sections/EcosystemSection';
import { UniversalAccessSection } from '@/components/sections/UniversalAccessSection';
import { MwikilaModesSection } from '@/components/sections/MwikilaModesSection';
import { InteractiveModesSection } from '@/components/sections/InteractiveModesSection';
import { PlatformShowcaseSection } from '@/components/sections/PlatformShowcaseSection';
import { BentoGrid } from '@/components/sections/BentoGrid';
import { InsightsAndScaleSection } from '@/components/sections/InsightsAndScaleSection';
import { RoadmapCTASection } from '@/components/sections/RoadmapCTASection';
import { getLocale } from '@/lib/locale';

/**
 * Marketing home — Borjie-mirrored LitFin narrative arc, adapted to
 * BossNyumba's real-estate domain. Mr. Mwikila persona is preserved.
 *
 * Above-fold (eager, in initial JS payload):
 *   00  Nav
 *   01  Hero                    — Live Fabric two-column
 *   02  BrainClaimsBanner       — evidence-backed claims
 *   03  TrustStrip              — regulator + infra wordwall
 *   04  CapabilitiesGrid        — twelve shipped capabilities
 *   05  FrontierBanner          — kicker band before main below-fold flow
 *   06  ProblemSolution         — WHY-A-PROPERTY-OS problem/solution duo
 *
 * Below-fold (LazyVisible, IntersectionObserver gate 400px ahead):
 *   07  EcosystemSection        — regulator + market + money-rails grid
 *   08  UniversalAccessSection  — bilingual sw/en + multi-device framing
 *   09  HowItWorks              — connect → observe → delegate → operate
 *   10  HeadBriefingDemo        — what a 06:00 brief feels like
 *   11  MwikilaModesSection     — Mr. Mwikila modes showcase
 *   12  AskShowcase             — talk to your portfolio · talk to the market
 *   13  InteractiveModesSection — Marketing chat · Home chat · Voice
 *   14  PlatformShowcaseSection — Owner / Workforce / Tenant surfaces
 *   15  BentoGrid               — asymmetric feature grid
 *   16  StatsBand               — pilot telemetry
 *   17  InsightsAndScaleSection — CountUp stats + pilot quote cards
 *   18  AutonomyDialDemo        — Advise → Autonomous
 *   19  AuditChainSection       — every action on the chain
 *   20  LoopValidatorSection    — OODA validator gates
 *   21  Pricing                 — per unit, per month, no seat tax
 *   22  Testimonial             — pilot voices
 *   23  RoadmapCTASection       — closing band: roadmap pills, dual CTA
 *   24  Footer                  — 4-column LitFin footer
 *
 * Eager sections ship in the initial chunk. Everything below ladders
 * through LazyVisible so framer-motion-heavy sections never enter the
 * first-paint payload.
 *
 * Note: BN's legacy components (Nav, Hero, CapabilitiesGrid, HowItWorks,
 * HeadBriefingDemo, AskShowcase, AutonomyDialDemo, AuditChainSection,
 * Pricing, Testimonial, Footer) currently render English-only and do
 * not accept a `locale` prop. The page still resolves `locale` so the
 * newly-ported i18n-aware sections can render bilingually.
 */
export default async function HomePage() {
  const locale = await getLocale();
  return (
    <>
      <Nav />
      <main id="main-content">
        {/* Above-fold */}
        <Hero />
        <BrainClaimsBanner locale={locale} />
        <StaggerReveal>
          <TrustStrip locale={locale} />
        </StaggerReveal>
        <StaggerReveal>
          <CapabilitiesGrid />
        </StaggerReveal>
        <FrontierBanner locale={locale} />
        <ProblemSolution locale={locale} />

        {/* Below-fold — deferred to IntersectionObserver */}
        <LazyVisible placeholderClassName="min-h-[520px]">
          <EcosystemSection locale={locale} />
        </LazyVisible>
        <LazyVisible placeholderClassName="min-h-[480px]">
          <UniversalAccessSection locale={locale} />
        </LazyVisible>
        <LazyVisible placeholderClassName="min-h-[480px]">
          <HowItWorks />
        </LazyVisible>
        <LazyVisible placeholderClassName="min-h-[520px]">
          <HeadBriefingDemo />
        </LazyVisible>
        <LazyVisible
          placeholderClassName="min-h-[560px]"
          fallback={<SectionSkeleton minHeight={560} cards={3} />}
        >
          <MwikilaModesSection locale={locale} />
        </LazyVisible>
        <LazyVisible placeholderClassName="min-h-[480px]">
          <AskShowcase />
        </LazyVisible>
        <LazyVisible placeholderClassName="min-h-[520px]">
          <InteractiveModesSection locale={locale} />
        </LazyVisible>
        <LazyVisible placeholderClassName="min-h-[520px]">
          <PlatformShowcaseSection locale={locale} />
        </LazyVisible>
        <LazyVisible
          placeholderClassName="min-h-[600px]"
          fallback={<SectionSkeleton minHeight={600} cards={4} />}
        >
          <BentoGrid locale={locale} />
        </LazyVisible>
        <LazyVisible placeholderClassName="min-h-[320px]">
          <StatsBand locale={locale} />
        </LazyVisible>
        <LazyVisible
          placeholderClassName="min-h-[480px]"
          fallback={<SectionSkeleton minHeight={480} cards={3} />}
        >
          <InsightsAndScaleSection locale={locale} />
        </LazyVisible>
        <LazyVisible placeholderClassName="min-h-[480px]">
          <AutonomyDialDemo />
        </LazyVisible>
        <LazyVisible placeholderClassName="min-h-[480px]">
          <AuditChainSection />
        </LazyVisible>
        <LazyVisible placeholderClassName="min-h-[480px]">
          <LoopValidatorSection locale={locale} />
        </LazyVisible>
        <LazyVisible placeholderClassName="min-h-[520px]">
          <Pricing />
        </LazyVisible>
        <LazyVisible placeholderClassName="min-h-[400px]">
          <Testimonial />
        </LazyVisible>
        <LazyVisible placeholderClassName="min-h-[480px]">
          <RoadmapCTASection locale={locale} />
        </LazyVisible>
      </main>
      <Footer />
    </>
  );
}
