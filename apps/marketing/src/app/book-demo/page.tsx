import type { Metadata } from 'next';
import Link from 'next/link';
import { Calendar, MessageSquare, Mail } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';

export const metadata: Metadata = {
  title: 'Book a 20-minute demo — BossNyumba',
  description:
    'Twenty minutes with our solutions team. Bring a sample of your portfolio; leave with a cockpit preview tailored to your buildings, currencies, and council.',
};

interface DemoChannel {
  readonly icon: typeof Calendar;
  readonly title: string;
  readonly body: string;
  readonly href: string;
  readonly cta: string;
  /** Single primary path — the others are secondary so there is real hierarchy. */
  readonly primary: boolean;
  /** External (off-site) target — opens a new tab with safe rel. */
  readonly external: boolean;
}

const CHANNELS: ReadonlyArray<DemoChannel> = [
  {
    icon: Calendar,
    title: 'Pick a time',
    body: 'Self-serve on the calendar. Twenty-minute slot, every weekday between 09:00 and 17:00 EAT.',
    href: 'https://cal.com/bossnyumba/20-minute-demo',
    cta: 'Open calendar',
    primary: true,
    external: true,
  },
  {
    icon: MessageSquare,
    title: 'Ask Mr. Mwikila',
    body: 'Use the in-app chat widget. Mr. Mwikila books the demo for you and adds the prep notes to your account.',
    href: '/sign-up',
    cta: 'Sign up + chat',
    primary: false,
    external: false,
  },
  {
    icon: Mail,
    title: 'Email the team',
    body: 'Write to our Dar es Salaam solutions team. EAT business hours, Swahili and English.',
    href: 'mailto:sales@bossnyumba.com',
    cta: 'Email sales@bossnyumba.com',
    primary: false,
    external: false,
  },
];

const PRIMARY_CTA =
  'bg-signal-500 text-primary-foreground hover:bg-signal-400';
const SECONDARY_CTA =
  'border border-border bg-surface text-foreground hover:border-signal-500/60 hover:text-signal-500';

export default function BookDemoPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-20 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          Book a demo
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Twenty minutes. Real portfolio. Real cockpit.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-foreground/75">
          Bring a sample of your buildings, leases, or rent roll. We
          import it live and walk you through the cockpit you would land
          on tomorrow. No slide decks; no follow-up sales calls unless
          you ask for one.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {CHANNELS.map((c) => {
            const ctaClass = `mt-6 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition-all ${
              c.primary ? PRIMARY_CTA : SECONDARY_CTA
            }`;
            return (
              <article
                key={c.title}
                className={`flex h-full flex-col rounded-2xl border bg-surface p-6 ${
                  c.primary ? 'border-signal-500/50' : 'border-border'
                }`}
              >
                <c.icon className="h-5 w-5 text-signal-500" aria-hidden="true" />
                <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground">
                  {c.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground/70">
                  {c.body}
                </p>
                {c.external ? (
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={ctaClass}
                  >
                    {c.cta}
                  </a>
                ) : (
                  <Link href={c.href} className={ctaClass}>
                    {c.cta}
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
