import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { MwikilaChip } from '@/components/shared/MwikilaChip';
import { OwnerSignInForm } from '@/components/auth/OwnerSignInForm';
import { getLocale } from '@/lib/locale';
import { type Locale } from '@/lib/i18n';
import { TIERS, tierLabel } from '@/lib/pricing';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Ingia — BossNyumba',
      description:
        'Ingia kwenye BossNyumba. Jisajili kwa simu yako iliyounganishwa na M-Pesa, NIDA, au barua pepe. Mwl. Mwikila ataendelea kutoka pale ulipoachia.',
    };
  }
  return {
    title: 'Log In — BossNyumba',
    description:
      'Log in to BossNyumba. Sign in with your M-Pesa-linked phone, NIDA, or email. Mr. Mwikila will pick up where you left off.',
  };
}

interface SignInCopy {
  readonly kicker: string;
  readonly headline: string;
  readonly sub: string;
  readonly noAccount: string;
  readonly signUpFree: (tierName: string) => string;
  readonly forgot: string;
}

const COPY: Record<Locale, SignInCopy> = {
  en: {
    kicker: 'Welcome back',
    headline: 'Log in to BossNyumba.',
    sub: 'Mr. Mwikila will pick up where you left off. Choose how you signed up.',
    noAccount: 'No account yet?',
    signUpFree: (tierName) => `Sign Up — free on ${tierName}`,
    forgot: 'Forgot your password?',
  },
  sw: {
    kicker: 'Karibu tena',
    headline: 'Ingia kwenye BossNyumba.',
    sub: 'Mwl. Mwikila ataendelea kutoka pale ulipoachia. Chagua jinsi ulivyojisajili.',
    noAccount: 'Bado huna akaunti?',
    signUpFree: (tierName) => `Jisajili — bure kwenye ${tierName}`,
    forgot: 'Umesahau nenosiri lako?',
  },
};

/**
 * /sign-in — owner login landing. Locale-aware: the entire page
 * resolves through `getLocale()` so the rendered copy is pure
 * English or pure Swahili (never mixed).
 *
 * The real authentication exchange is owned by the mounted
 * `<OwnerSignInForm>` client component, which calls
 * `supabase.auth.signInWithPassword` against the configured Supabase
 * project and hard-redirects into the owner cockpit on success. The
 * form is wrapped in a `<Suspense>` boundary because it reads
 * `useSearchParams()` (`?from=signup`) — Next.js App Router requires
 * the boundary for client components that consume search params.
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

          <Suspense fallback={null}>
            <OwnerSignInForm locale={locale} />
          </Suspense>

          <p className="mt-4 text-center text-sm text-foreground/70">
            <Link
              href="/forgot-password"
              data-testid="signin-forgot-link"
              className="font-medium text-signal-500 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500 rounded-sm"
            >
              {copy.forgot}
            </Link>
          </p>

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
