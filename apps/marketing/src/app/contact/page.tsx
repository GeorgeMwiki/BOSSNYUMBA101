import type { Metadata } from 'next';
import { getLocale } from '@/lib/locale';
import Link from 'next/link';
import { Mail, MapPin } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Wasiliana — BossNyumba',
      description:
        'Wasiliana na timu ya BossNyumba. Mauzo, msaada, usalama, vyombo vya habari, na ushirikiano — Dar es Salaam, Nairobi, saa za kazi za EAT.',
    };
  }
  return {
    title: 'Contact — BossNyumba',
    description:
      'Reach the BossNyumba team. Sales, support, security, press, and partnerships — Dar es Salaam, Nairobi, EAT business hours.',
  };
}

interface Channel {
  readonly icon: typeof Mail;
  readonly heading: string;
  readonly body: string;
  readonly cta: string;
  readonly href: string;
}

const CHANNELS: ReadonlyArray<Channel> = [
  {
    icon: Mail,
    heading: 'Sales',
    body: 'Speak to our solutions team. Bring a sample of your portfolio; leave with a cockpit preview.',
    cta: 'sales@bossnyumba.com',
    href: 'mailto:sales@bossnyumba.com',
  },
  {
    icon: Mail,
    heading: 'Support',
    body: 'Existing customers. Mr. Mwikila is faster; this address is for paid-tier escalations.',
    cta: 'support@bossnyumba.com',
    href: 'mailto:support@bossnyumba.com',
  },
  {
    icon: Mail,
    heading: 'Security',
    body: 'Responsible disclosure. PGP key on the security page. We acknowledge within 4 hours.',
    cta: 'security@bossnyumba.com',
    href: 'mailto:security@bossnyumba.com',
  },
  {
    icon: Mail,
    heading: 'Press',
    body: 'Embargoed and on-record press enquiries. Bilingual sw/en.',
    cta: 'press@bossnyumba.com',
    href: 'mailto:press@bossnyumba.com',
  },
  {
    icon: Mail,
    heading: 'Partnerships',
    body: "Bank, regulator, agency, and platform partnerships. We're picky about partners; please come with a thesis.",
    cta: 'partnerships@bossnyumba.com',
    href: 'mailto:partnerships@bossnyumba.com',
  },
  {
    icon: Mail,
    heading: 'Careers',
    body: 'Send us your CV and a one-paragraph note on what you would build here.',
    cta: 'careers@bossnyumba.com',
    href: 'mailto:careers@bossnyumba.com',
  },
];

export default function ContactPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-6 pb-24 pt-20 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">Contact</p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Reach the right desk.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-foreground/75">
          We are in Dar es Salaam and Nairobi. EAT business hours. Mr. Mwikila is always on; humans
          are on weekdays 09:00-17:00 EAT and Saturdays 09:00-13:00 EAT.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CHANNELS.map((c) => (
            <article
              key={c.heading}
              className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6"
            >
              <c.icon className="h-5 w-5 text-signal-500" aria-hidden="true" />
              <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground">
                {c.heading}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground/70">{c.body}</p>
              <Link
                href={c.href}
                className="mt-4 inline-flex items-center text-sm font-semibold text-signal-500 hover:underline"
              >
                {c.cta}
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-border bg-surface p-6">
            <MapPin className="h-5 w-5 text-signal-500" aria-hidden="true" />
            <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground">
              Dar es Salaam (HQ)
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              Msasani Peninsula
              <br />
              Dar es Salaam, Tanzania
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-surface p-6">
            <MapPin className="h-5 w-5 text-signal-500" aria-hidden="true" />
            <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground">
              Nairobi
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              Westlands, Waiyaki Way
              <br />
              Nairobi, Kenya
            </p>
          </article>
        </div>

        <p className="mt-12 inline-flex items-center gap-2 text-sm text-foreground/70">
          <Mail className="h-4 w-4 text-signal-500" aria-hidden="true" />
          Prefer to write?{' '}
          <a
            href="mailto:hello@bossnyumba.com"
            className="font-semibold text-signal-500 hover:underline"
          >
            hello@bossnyumba.com
          </a>
        </p>
      </div>
    </PageShell>
  );
}
