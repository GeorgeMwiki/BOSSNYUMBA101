import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, MessageSquare, Phone, ShieldAlert } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';

export const metadata: Metadata = {
  title: 'Support — Boss Nyumba',
  description:
    'How to reach the Boss Nyumba team. Mr. Mwikila chat, EAT phone hours, email, and the security disclosure address. Swahili and English.',
};

interface Channel {
  readonly icon: typeof MessageSquare;
  readonly title: string;
  readonly tone: 'primary' | 'secondary';
  readonly body: string;
  readonly href: string;
  readonly cta: string;
  readonly sla: string;
}

const CHANNELS: ReadonlyArray<Channel> = [
  {
    icon: MessageSquare,
    title: 'Mr. Mwikila chat',
    tone: 'primary',
    body: 'In-app chat widget. Mr. Mwikila handles tier-1 + tier-2; escalates to a human when needed.',
    href: '/sign-in',
    cta: 'Open the app',
    sla: 'Instant · 24/7',
  },
  {
    icon: BookOpen,
    title: 'Help centre',
    tone: 'secondary',
    body: 'Step-by-step guides and how-to videos for every screen and workflow. Swahili and English.',
    href: '/docs',
    cta: 'Browse the docs',
    sla: 'Searchable · 24/7',
  },
  {
    icon: Phone,
    title: 'Phone (EAT)',
    tone: 'secondary',
    body: 'Speak to our Dar es Salaam team. Weekdays 09:00-17:00 EAT. Saturdays 09:00-13:00 EAT.',
    href: 'tel:+255222000000',
    cta: 'Call +255 22 200 0000',
    sla: 'Live · weekdays + Sat AM',
  },
  {
    icon: ShieldAlert,
    title: 'Security disclosure',
    tone: 'secondary',
    body: 'Found a vulnerability? Email security@bossnyumba.com with our PGP key. We acknowledge within 4 hours.',
    href: '/security',
    cta: 'See security policy',
    sla: '4-hour ack',
  },
];

export default function SupportPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-6 pb-24 pt-20 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          Support
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          We answer in Swahili by default.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-foreground/75">
          Mr. Mwikila is your first line; the human team is your second.
          For paid tiers, SLAs are baked into your contract. For free
          tier (Smallholder), we still aim to answer within one business day.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {CHANNELS.map((c) => (
            <article
              key={c.title}
              className={[
                'flex h-full flex-col rounded-2xl border p-6',
                c.tone === 'primary'
                  ? 'border-signal-500/40 bg-surface ring-1 ring-signal-500/20'
                  : 'border-border bg-surface',
              ].join(' ')}
            >
              <c.icon className="h-5 w-5 text-signal-500" aria-hidden="true" />
              <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground">
                {c.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground/70">
                {c.body}
              </p>
              <p className="mt-3 font-mono text-[0.65rem] uppercase tracking-widest text-foreground/60">
                {c.sla}
              </p>
              <Link
                href={c.href}
                className={[
                  'mt-5 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition-all',
                  c.tone === 'primary'
                    ? 'bg-signal-500 text-primary-foreground hover:bg-signal-400'
                    : 'border border-border text-foreground hover:bg-surface-raised',
                ].join(' ')}
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
