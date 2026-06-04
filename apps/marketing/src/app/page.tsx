// marketing-rebase: this wrapper is now a Server Component. The four
// children below remain client components ("use client" at the top of
// each file) — Next.js mounts client children from an RSC parent. The
// wrapper itself stays out of the client bundle so the children stream
// independently.
//
// Source pattern this mirrors:
//   UPSTREAM_PATH/src/app/(marketing)/page.tsx (lean 4-component
//   composition: IgnitionHero + BrainClaimsBanner + CapabilitiesSection
//   + HomePage).

import { HomePage } from '@/components/home/HomePage';
import { IgnitionHero } from '@/components/marketing/IgnitionHero';
import { CapabilitiesSection } from '@/components/marketing/CapabilitiesSection';
import { BrainClaimsBanner } from '@/components/BrainClaimsBanner';
import { getLocale } from '@/lib/locale';

export default async function MarketingPage() {
  const locale = await getLocale();
  return (
    <>
      <IgnitionHero locale={locale} />
      <BrainClaimsBanner locale={locale} />
      <CapabilitiesSection audience="platform" locale={locale} />
      <HomePage locale={locale} />
    </>
  );
}
