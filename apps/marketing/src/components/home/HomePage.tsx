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

interface ListItem {
  readonly title: string;
  readonly desc: string;
}

const PROBLEM_ITEMS_EN: ReadonlyArray<ListItem> = [
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
];

const PROBLEM_ITEMS_SW: ReadonlyArray<ListItem> = [
  {
    title: 'Shughuli zilizotenganishwa',
    desc: 'Mikataba kwenye Word, kodi kwenye Excel, matengenezo kwenye WhatsApp, ushuru kwenye folda. Kila mmiliki anaunganisha tena mtiririko ule ule kila mwezi.',
  },
  {
    title: 'Maeneo yasiyoonekana ya mtiririko wa fedha',
    desc: 'Unaona tu kilicholipwa baada ya tukio. Hakuna onyo la mapema kwamba Kitengo 5 kinakaribia kushindwa kulipa.',
  },
  {
    title: 'Mzigo wa utii',
    desc: 'NHC, BRELA na TRA wote wanahitaji data ile ile katika maumbo tofauti. Wamiliki wanalipia wahasibu kukusanya kile ambacho kingepaswa kuwepo tayari.',
  },
  {
    title: 'Wapangaji wasioonekana',
    desc: 'Wapangaji wengi ni wazuri. Wachache si. Bila historia, kila uchunguzi unaanza kutoka sifuri. Wapangaji wabaya wanagharimu mfumo.',
  },
];

const SOLUTION_ITEMS_EN: ReadonlyArray<ListItem> = [
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
];

const SOLUTION_ITEMS_SW: ReadonlyArray<ListItem> = [
  {
    title: 'Ubongo mmoja wa mali unaoendesha',
    desc: 'Mkataba, kodi, matengenezo, hazina, utii, milki na daftari la mali — mfumo mmoja, chanzo kimoja cha ukweli. Mwl. Mwikila daima anaona picha kamili.',
  },
  {
    title: 'Kila malipo, kila ahadi, vimekaguliwa',
    desc: 'Leja ya hash-chain. Inaweza kurudishwa tu kwa ingizo la kupinga. Upatanisho wa kiwango cha benki. Wadhibiti wanaweza kuthibitisha mstari wowote bila wewe kuhusika.',
  },
  {
    title: 'AI inayoomba idhini ipasavyo',
    desc: 'Mwl. Mwikila ni mshirika tulivu — anaandaa kurefusha, taarifa ya kuondoa, kuwasilisha BRELA, na kusubiri wewe kusaini. Hatendi kamwe kwa mamlaka yake mwenyewe.',
  },
  {
    title: 'Imejengwa kwa Tanzania kwanza',
    desc: 'M-Pesa, Airtel Money, Kiswahili-kwanza. Kisha Kenya, Uganda, Afrika Mashariki yote. Mfumo ule ule wa uendeshaji, unaotambua sheria za nchi.',
  },
];

const BANNER_COPY_EN = {
  frontierTitle: 'Property OS is the frontier.',
  frontierAccent: 'BossNyumba is the operating system.',
  frontierSub:
    'Built for a market where the workflows themselves have not been digitised yet. Not a CRM. Not a spreadsheet. A brain that runs the estate.',
  gapKicker: 'The gap we are closing',
  gapHeadingFirst: 'Property management,',
  gapHeadingAccent: 'from sprawl to system.',
  gapSubOne:
    'Most landlords run their estate the same way they did 30 years ago. The tools changed name; the workflow did not.',
  gapSubTwo:
    'BossNyumba is the operating system that finally puts the entire estate — every lease, every tenant, every shilling — under one brain.',
  problemTitle: 'The problem today',
  solutionTitle: 'What BossNyumba does',
};

const BANNER_COPY_SW = {
  frontierTitle: 'Mfumo wa uendeshaji wa mali ndio mpaka.',
  frontierAccent: 'BossNyumba ndio mfumo wa uendeshaji.',
  frontierSub:
    'Imejengwa kwa soko ambapo mtiririko wa kazi wenyewe haujadijitishwa bado. Sio CRM. Sio lahajedwali. Ni ubongo unaoendesha mali.',
  gapKicker: 'Pengo tunalofunga',
  gapHeadingFirst: 'Usimamizi wa mali,',
  gapHeadingAccent: 'kutoka sambamba hadi mfumo.',
  gapSubOne:
    'Wamiliki wengi wa nyumba wanaendesha mali zao kwa njia ile ile waliyofanya miaka 30 iliyopita. Vifaa vilibadilisha jina; mtiririko wa kazi haukubadilika.',
  gapSubTwo:
    'BossNyumba ni mfumo wa uendeshaji unaoweka hatimaye mali yote — kila mkataba, kila mpangaji, kila shilingi — chini ya ubongo mmoja.',
  problemTitle: 'Tatizo la leo',
  solutionTitle: 'BossNyumba inafanya nini',
};

export interface HomePageProps {
  readonly locale: Locale;
}

export function HomePage({ locale }: HomePageProps) {
  const sw = locale === 'sw';
  const banner = sw ? BANNER_COPY_SW : BANNER_COPY_EN;
  const problemItems = sw ? PROBLEM_ITEMS_SW : PROBLEM_ITEMS_EN;
  const solutionItems = sw ? SOLUTION_ITEMS_SW : SOLUTION_ITEMS_EN;

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
              {banner.frontierTitle}{' '}
              <span className="bg-[linear-gradient(135deg,hsl(36_86%_64%)_0%,hsl(24_72%_50%)_50%,hsl(14_62%_28%)_100%)] bg-clip-text text-transparent">
                {banner.frontierAccent}
              </span>
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              {banner.frontierSub}
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
            <span className="text-meta font-semibold uppercase tracking-[0.16em] text-primary">
              {banner.gapKicker}
            </span>
            <h2 className="mt-3 text-4xl font-bold tracking-[-0.025em] text-foreground md:text-5xl">
              {banner.gapHeadingFirst}{' '}
              <span className="bg-[linear-gradient(135deg,hsl(36_86%_64%)_0%,hsl(24_72%_50%)_50%,hsl(14_62%_28%)_100%)] bg-clip-text text-transparent">
                {banner.gapHeadingAccent}
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              {banner.gapSubOne}
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-lg font-medium text-foreground">
              {banner.gapSubTwo}
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex h-full flex-col rounded-lg border border-border bg-background p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10">
                  <TrendingUp className="h-5 w-5 text-destructive" strokeWidth={1.75} />
                </div>
                <h3 className="text-xl font-semibold tracking-[-0.015em] text-foreground">
                  {banner.problemTitle}
                </h3>
              </div>
              <div className="space-y-5">
                {problemItems.map((item, i) => (
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
                  {banner.solutionTitle}
                </h3>
              </div>
              <div className="space-y-5">
                {solutionItems.map((item) => (
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
