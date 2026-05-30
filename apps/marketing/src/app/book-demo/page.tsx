import type { Metadata } from 'next';
import Link from 'next/link';
import { Calendar, MessageSquare, Phone } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';

export const metadata: Metadata = {
  title: 'Book a 20-minute demo — Boss Nyumba',
  description:
    'Twenty minutes with our solutions team. Bring a sample of your portfolio; leave with a cockpit preview tailored to your buildings, currencies, and council.',
};

const CHANNELS: ReadonlyArray<{
  icon: typeof Calendar;
  title: string;
  body: string;
  href: string;
  cta: string;
}> = [
  {
    icon: Calendar,
    title: 'Pick a time',
    body: 'Self-serve on the calendar. Twenty-minute slot, every weekday between 09:00 and 17:00 EAT.',
    href: 'https://cal.com/bossnyumba/20-minute-demo',
    cta: 'Open calendar',
  },
  {
    icon: MessageSquare,
    title: 'Ask Mr. Mwikila',
    body: 'Use the in-app chat widget. Mr. Mwikila books the demo for you and adds the prep notes to your account.',
    href: '/sign-up',
    cta: 'Sign Up + chat',
  },
  {
    icon: Phone,
    title: 'Phone Dar es Salaam',
    body: 'Speak to a person. Our solutions team is in Dar, EAT business hours. Swahili and English.',
    href: 'tel:+255222000000',
    cta: 'Call +255 22 200 0000',
  },
];

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
          {CHANNELS.map((c) => (
            <article
              key={c.title}
              className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6"
            >
              <c.icon className="h-5 w-5 text-signal-500" aria-hidden="true" />
              <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground">
                {c.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground/70">
                {c.body}
              </p>
              <Link
                href={c.href}
                className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-signal-500 px-4 text-sm font-semibold text-primary-foreground transition-all hover:bg-signal-400"
              >
                {c.cta}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
