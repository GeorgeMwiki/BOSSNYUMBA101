import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { MwikilaChip } from '@/components/shared/MwikilaChip';

export const metadata: Metadata = {
  title: 'Log In — Boss Nyumba',
  description:
    'Log in to Boss Nyumba. Sign in with your M-Pesa-linked phone, NIDA, or email. Mr. Mwikila will pick up where you left off.',
};

/**
 * /sign-in — owner login landing.
 *
 * Static skeleton only. The actual auth POST lands at the api-gateway
 * (`/api/v1/auth/sign-in`) and the form widget is owned by API agent
 * #226. We surface the entry point + the canonical Mr. Mwikila chip +
 * a clear "no account yet" path to /sign-up.
 *
 * No "trial" language per Borjie discipline — CTAs are Log In and
 * Sign Up only.
 */
export default function SignInPage() {
  return (
    <PageShell>
      <div
        className="relative min-h-screen overflow-hidden bg-background text-foreground"
      >
        <div className="hero-aurora" aria-hidden="true" />
        <div className="absolute inset-0 cinematic-grid opacity-20" aria-hidden="true" />
        <div className="relative mx-auto max-w-xl px-6 py-20 lg:py-28">
          <header className="mb-10 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
              Karibu tena (Welcome back)
            </p>
            <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
              Log in to Boss Nyumba.
            </h1>
            <p className="mx-auto mt-5 max-w-prose-wide text-base leading-relaxed text-neutral-400">
              Mr. Mwikila will pick up where you left off. Choose how you signed up.
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
                  Phone, NIDA, or email
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
                  Password
                  <Link
                    href="/sign-in/forgot"
                    className="text-xs font-medium text-signal-500 hover:underline"
                  >
                    Forgot?
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
                Log In
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-neutral-400">
            No account yet?{' '}
            <Link
              href="/sign-up"
              className="font-medium text-signal-500 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500 rounded-sm"
            >
              Sign Up — free on Mkulima
            </Link>
          </p>

          <p className="mt-8 inline-flex w-full items-center justify-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-widest text-neutral-500">
            <ShieldCheck className="h-3 w-3 text-signal-500" aria-hidden="true" />
            BRELA · TRA · Housing-regulator verified
          </p>
        </div>
      </div>
    </PageShell>
  );
}
