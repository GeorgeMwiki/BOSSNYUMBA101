import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { MwikilaChip } from '@/components/shared/MwikilaChip';
import { getLocale } from '@/lib/locale';
import { type Locale } from '@/lib/i18n';
import { TIERS, tierLabel } from '@/lib/pricing';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Ingia — Boss Nyumba',
      description:
        'Ingia kwenye Boss Nyumba. Jisajili kwa simu yako iliyounganishwa na M-Pesa, NIDA, au barua pepe. Bw. Mwikila ataendelea kutoka pale ulipoachia.',
    };
  }
  return {
    title: 'Log In — Boss Nyumba',
    description:
      'Log in to Boss Nyumba. Sign in with your M-Pesa-linked phone, NIDA, or email. Mr. Mwikila will pick up where you left off.',
  };
}

interface SignInCopy {
  readonly kicker: string;
  readonly headline: string;
  readonly sub: string;
  readonly idLabel: string;
  readonly passwordLabel: string;
  readonly forgotLink: string;
  readonly submit: string;
  readonly noAccount: string;
  readonly signUpFree: (tierName: string) => string;
}

const COPY: Record<Locale, SignInCopy> = {
  en: {
    kicker: 'Welcome back',
    headline: 'Log in to Boss Nyumba.',
    sub: 'Mr. Mwikila will pick up where you left off. Choose how you signed up.',
    idLabel: 'Phone, NIDA, or email',
    passwordLabel: 'Password',
    forgotLink: 'Forgot?',
    submit: 'Log In',
    noAccount: 'No account yet?',
    signUpFree: (tierName) => `Sign Up — free on ${tierName}`,
  },
  sw: {
    kicker: 'Karibu tena',
    headline: 'Ingia kwenye Boss Nyumba.',
    sub: 'Bw. Mwikila ataendelea kutoka pale ulipoachia. Chagua jinsi ulivyojisajili.',
    idLabel: 'Simu, NIDA, au barua pepe',
    passwordLabel: 'Nenosiri',
    forgotLink: 'Umesahau?',
    submit: 'Ingia',
    noAccount: 'Bado huna akaunti?',
    signUpFree: (tierName) => `Jisajili — bure kwenye ${tierName}`,
  },
};

/**
 * /sign-in — owner login landing. Locale-aware: the entire page
 * resolves through `getLocale()` so the rendered copy is pure
 * English or pure Swahili (never mixed).
 *
 * Static skeleton only. The actual auth POST lands at the api-gateway
 * (`/api/v1/auth/sign-in`) and the form widget is owned by API agent
 * #226. We surface the entry point + the canonical Mr. Mwikila chip +
 * a clear "no account yet" path to /sign-up.
 *
 * No "trial" language per product discipline — CTAs are Log In and
 * Sign Up only.
 */
export default async function SignInPage() {
  const locale = await getLocale();
  const copy = COPY[locale] ?? COPY.en;
  const smallholder = tierLabel(TIERS[0], locale);

  return (
    <PageShell>
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <div className="hero-aurora" aria-hidden="true" />
        <div className="absolute inset-0 cinematic-grid opacity-20" aria-hidden="true" />
        <div className="relative mx-auto max-w-xl px-6 py-20 lg:py-28">
          <header className="mb-10 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
              {copy.kicker}
            </p>
            <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
              {copy.headline}
            </h1>
            <p className="mx-auto mt-5 max-w-prose-wide text-base leading-relaxed text-foreground/70">
              {copy.sub}
            </p>
            <div className="mt-6 flex justify-center">
              <MwikilaChip variant="compact" />
            </div>
          </header>

          <div className="rounded-2xl border border-border bg-surface/60 p-6 shadow-md">
            <form className="space-y-4" action="/api/v1/auth/sign-in" method="post">
              <div>
                <label
                  htmlFor="signin-id"
                  className="block text-sm font-semibold text-foreground"
                >
                  {copy.idLabel}
                </label>
                <input
                  id="signin-id"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  inputMode="text"
                  placeholder="+255 7XX XXX XXX"
                  className="mt-2 block w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-neutral-600 focus:border-signal-500 focus:outline-none focus:ring-1 focus:ring-signal-500"
                />
              </div>
              <div>
                <label
                  htmlFor="signin-password"
                  className="flex items-center justify-between text-sm font-semibold text-foreground"
                >
                  {copy.passwordLabel}
                  <Link
                    href="/sign-in/forgot"
                    className="text-xs font-medium text-signal-500 hover:underline"
                  >
                    {copy.forgotLink}
                  </Link>
                </label>
                <input
                  id="signin-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="mt-2 block w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-neutral-600 focus:border-signal-500 focus:outline-none focus:ring-1 focus:ring-signal-500"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-signal-500 px-5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-signal-400 active:scale-[0.98]"
              >
                {copy.submit}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-foreground/70">
            {copy.noAccount}{' '}
            <Link
              href="/sign-up"
              className="font-medium text-signal-500 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500 rounded-sm"
            >
              {copy.signUpFree(smallholder)}
            </Link>
          </p>

          <p className="mt-8 inline-flex w-full items-center justify-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-widest text-foreground/60">
            <ShieldCheck className="h-3 w-3 text-signal-500" aria-hidden="true" />
            BRELA · TRA · Housing-regulator verified
          </p>
        </div>
      </div>
    </PageShell>
  );
}
