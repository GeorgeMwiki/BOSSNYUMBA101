import { Nav } from '@/components/Nav';
import { Hero } from '@/components/Hero';
import { HeadBriefingDemo } from '@/components/HeadBriefingDemo';
import { AutonomyDialDemo } from '@/components/AutonomyDialDemo';
import { CapabilitiesGrid } from '@/components/CapabilitiesGrid';
import { HowItWorks } from '@/components/HowItWorks';
import { AskShowcase } from '@/components/AskShowcase';
import { AuditChainSection } from '@/components/AuditChainSection';
import { Testimonial } from '@/components/Testimonial';
import { Pricing } from '@/components/Pricing';
import { Footer } from '@/components/Footer';

/**
 * Marketing home — ordered so every section answers the next obvious
 * question.
 *
 *   01  Hero                 — what the product IS, one sentence
 *   02  Head Briefing        — what a morning with it looks like
 *   03  Autonomy Dial        — the five-level control, ten domains
 *   04  Capabilities Grid    — twelve shipped capabilities, one line each
 *   05  How It Works         — connect → observe → delegate → operate
 *   06  Ask showcase         — talk to your company · talk to the industry
 *   07  Audit chain          — every action cryptographically on the record
 *   08  Testimonial          — one voice, large
 *   09  Pricing              — per unit, per month, no seat tax
 */
export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <HeadBriefingDemo />
        <AutonomyDialDemo />
        <CapabilitiesGrid />
        <HowItWorks />
        <AskShowcase />
        <AuditChainSection />
        <Testimonial />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
