import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { MwikilaChip } from '@/components/shared/MwikilaChip';
import { getLocale } from '@/lib/locale';
import { type Locale } from '@/lib/i18n';
import { OwnerSignUpForm } from '@/components/auth/OwnerSignUpForm';
import { TIERS, tierLabel } from '@/lib/pricing';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Jisajili — Boss Nyumba',
      description:
        'Jisajili bure kwenye daraja la Mkulima. Hadi vyumba 5, kiti kimoja cha mtumiaji, ukusanyaji wa kodi kwa M-Pesa, daftari la maingizo mawili, mazungumzo na Bw. Mwikila. Hakuna kadi inayohitajika. Lugha mbili sw/en.',
    };
  }
  return {
    title: 'Sign Up — Boss Nyumba',
    description:
      'Sign up free on the Smallholder tier. Up to 5 units, one user seat, M-Pesa rent collection, double-entry ledger, Mr. Mwikila chat. No card needed. Bilingual sw/en.',
  };
}

interface SignUpCopy {
  readonly kicker: string;
  readonly headline: (tierName: string) => string;
  readonly sub: string;
  readonly fullName: string;
  readonly mpesaPhone: string;
  readonly mpesaHelp: string;
  readonly emailOptional: string;
  readonly agreePrefix: string;
  readonly agreeTerms: string;
  readonly agreeAnd: string;
  readonly agreePrivacy: string;
  readonly submit: string;
  readonly alreadyHave: string;
  readonly logIn: string;
}

const COPY: Record<Locale, SignUpCopy> = {
  en: {
    kicker: 'Welcome',
    headline: (tierName) => `Sign up — free on ${tierName}.`,
    sub: 'Up to 5 units, one user seat, M-Pesa rent collection. No card needed. Upgrade only when your portfolio grows.',
    fullName: 'Full name',
    mpesaPhone: 'M-Pesa-linked phone number',
    mpesaHelp: 'We send a one-time code over SMS to verify. Standard rates apply.',
    emailOptional: 'Email (optional)',
    agreePrefix: 'I agree to the',
    agreeTerms: 'Terms of Service',
    agreeAnd: 'and',
    agreePrivacy: 'Privacy Notice',
    submit: 'Sign Up — free',
    alreadyHave: 'Already have an account?',
    logIn: 'Log In',
  },
  sw: {
    kicker: 'Karibu',
    headline: (tierName) => `Jisajili — bure kwenye ${tierName}.`,
    sub: 'Hadi vyumba 5, kiti kimoja cha mtumiaji, ukusanyaji wa kodi kwa M-Pesa. Hakuna kadi inayohitajika. Pandisha daraja portfolio yako inapokua.',
    fullName: 'Jina kamili',
    mpesaPhone: 'Nambari ya simu iliyounganishwa na M-Pesa',
    mpesaHelp: 'Tunatuma msimbo wa mara moja kwa SMS kuthibitisha. Gharama za kawaida zinatozwa.',
    emailOptional: 'Barua pepe (hiari)',
    agreePrefix: 'Nakubaliana na',
    agreeTerms: 'Masharti ya Huduma',
    agreeAnd: 'na',
    agreePrivacy: 'Taarifa ya Faragha',
    submit: 'Jisajili — bure',
    alreadyHave: 'Tayari una akaunti?',
    logIn: 'Ingia',
  },
};

/**
 * /sign-up — owner registration landing. Locale-aware: the entire
 * page resolves through `getLocale()` so the English render is pure
 * English and the Swahili render is pure Swahili.
 *
 * Static form skeleton. POST handler owned by API agent #226. We
 * deliberately use "Sign Up" language only — no "Start a free trial"
 * (product discipline).
 */
export default async function SignUpPage() {
  const locale = await getLocale();
  const copy = COPY[locale] ?? COPY.en;
  const smallholder = tierLabel(TIERS[0], locale);

  return (
    <PageShell>
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <div className="hero-aurora" aria-hidden="true" />
        <div
          className="absolute inset-0 cinematic-grid opacity-20"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-xl px-6 py-20 lg:py-28">
          <header className="mb-10 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
              {copy.kicker}
            </p>
            <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
              {copy.headline(smallholder)}
            </h1>
            <p className="mx-auto mt-5 max-w-prose-wide text-base leading-relaxed text-foreground/70">
              {copy.sub}
            </p>
            <div className="mt-6 flex justify-center">
              <MwikilaChip variant="compact" />
            </div>
          </header>

          <div className="rounded-2xl border border-border bg-surface/60 p-6 shadow-md">
            {/* The real owner sign-up funnel. POSTs to /api/v1/orgs/signup
                (creates the Supabase auth user + tenant/org/owner + a session,
                sets the bossnyumba-session cookie). Replaced the dead raw
                <form action="/api/v1/auth/sign-up"> which 404'd. */}
            <OwnerSignUpForm locale={locale} />
          </div>

          <p className="mt-6 text-center text-sm text-foreground/70">
            {copy.alreadyHave}{' '}
            <Link
              href="/sign-in"
              className="font-medium text-signal-500 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500 rounded-sm"
            >
              {copy.logIn}
            </Link>
          </p>

          <p className="mt-8 inline-flex w-full items-center justify-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-widest text-foreground/60">
            <ShieldCheck className="h-3 w-3 text-signal-500" aria-hidden="true" />
            SOC 2 Type II · ISO 27001 · TZ DPA aligned
          </p>
        </div>
      </div>
    </PageShell>
  );
}
