import { Nav } from '@/components/Nav';
import { Hero } from '@/components/Hero';
import { HeadBriefingDemo } from '@/components/HeadBriefingDemo';
import { AutonomyDialDemo } from '@/components/AutonomyDialDemo';
import { CapabilitiesGrid } from '@/components/CapabilitiesGrid';
import { HowItWorks } from '@/components/HowItWorks';
import { Testimonial } from '@/components/Testimonial';
import { Pricing } from '@/components/Pricing';
import { Footer } from '@/components/Footer';

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
        <Testimonial />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
