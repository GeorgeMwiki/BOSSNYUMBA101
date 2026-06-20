import type { Metadata } from 'next';
import { getLocale } from '@/lib/locale';
import Link from 'next/link';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { MwikilaChip } from '@/components/shared/MwikilaChip';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Mpango wa majaribio — BossNyumba',
      description:
        'Endesha BossNyumba sambamba na shughuli zako za sasa kwa siku 90. Usakinishaji bila malipo, meneja wa mafanikio aliyetengwa mahususi kwa ajili yako, na ripoti ya maandishi inayoonyesha uvujaji wa mapato tuliougundua.',
    };
  }
  return {
    title: 'Pilot programme — BossNyumba',
    description:
      'Run BossNyumba alongside your current operations for 90 days. Free implementation, dedicated success manager, and a written report with the leakage we found.',
  };
}

const COMMITMENTS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'No card, no commit',
    body: "Professional tier free for 90 days. We don't ask for a card until the pilot converts.",
  },
  {
    title: 'Implementation included',
    body: 'Our Dar es Salaam team imports your portfolio, sets your autonomy dial, and trains your team — included.',
  },
  {
    title: 'Written leakage report',
    body: 'At day 60 you receive a written analysis of leakage Mr. Mwikila found in rent, maintenance, and compliance — yours to keep, regardless of conversion.',
  },
  {
    title: 'Mr. Mwikila co-pilot',
    body: 'Your success manager pairs with Mr. Mwikila for the full 90 days; Swahili-first whenever you want.',
  },
];

export default function PilotPage() {
  return (
    <PageShell>
      <section className="relative overflow-hidden">
        <div className="hero-aurora" aria-hidden="true" />
        <div className="absolute inset-0 cinematic-grid opacity-25" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center lg:py-28">
          <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
            Pilot programme
          </p>
          <h1 className="mt-5 font-display text-5xl font-medium tracking-tight text-balance sm:text-6xl">
            Ninety days. Real portfolios. Real numbers.
          </h1>
          <p className="mx-auto mt-6 max-w-prose-widest text-lg leading-relaxed text-foreground/70 sm:text-xl">
            For portfolio landlords, professional managers, and REITs. Run BossNyumba alongside your
            current system for 90 days. Free implementation, written leakage report, no card.
          </p>
          <div className="mt-8 flex justify-center">
            <MwikilaChip />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16 lg:px-8">
        <ul className="grid gap-4 md:grid-cols-2">
          {COMMITMENTS.map((c) => (
            <li
              key={c.title}
              className="flex gap-4 rounded-2xl border border-border bg-surface p-6"
            >
              <CheckCircle2
                className="h-5 w-5 shrink-0 text-signal-500"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
                  {c.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-foreground/70">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/book-demo"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-md bg-signal-500 px-7 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-signal-400"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Book the pilot kickoff
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-surface/60 px-7 text-sm font-semibold text-foreground transition-colors hover:bg-surface-raised"
          >
            Email the team
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
