import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { MwikilaChip } from '@/components/shared/MwikilaChip';

export const metadata: Metadata = {
  title: 'Sign Up — Boss Nyumba',
  description:
    'Sign Up free on Mkulima (T1). Up to 5 units, one user seat, M-Pesa rent collection, double-entry ledger, Mr. Mwikila chat. No card needed. Swahili-first.',
};

/**
 * /sign-up — owner registration landing.
 *
 * Static form skeleton. POST handler owned by API agent #226. We
 * deliberately use "Sign Up" language only — no "Start a free trial"
 * (Borjie discipline).
 */
export default function SignUpPage() {
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
              Karibu (Welcome)
            </p>
            <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
              Sign Up — free on Mkulima.
            </h1>
            <p className="mx-auto mt-5 max-w-prose-wide text-base leading-relaxed text-neutral-400">
              Up to 5 units, one user seat, M-Pesa rent collection. No
              card needed. Upgrade only when your portfolio grows.
            </p>
            <div className="mt-6 flex justify-center">
              <MwikilaChip variant="compact" />
            </div>
          </header>

          <div className="rounded-2xl border border-border bg-surface/60 p-6 shadow-md">
            <form className="space-y-4" action="/api/v1/auth/sign-up" method="post">
              <div>
                <label
                  htmlFor="signup-name"
                  className="block text-sm font-semibold text-foreground"
                >
                  Full name
                </label>
                <input
                  id="signup-name"
                  name="full_name"
                  type="text"
                  autoComplete="name"
                  required
                  className="mt-2 block w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-signal-500 focus:outline-none focus:ring-1 focus:ring-signal-500"
                />
              </div>
              <div>
                <label
                  htmlFor="signup-phone"
                  className="block text-sm font-semibold text-foreground"
                >
                  M-Pesa-linked phone number
                </label>
                <input
                  id="signup-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  inputMode="tel"
                  placeholder="+255 7XX XXX XXX"
                  className="mt-2 block w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-neutral-600 focus:border-signal-500 focus:outline-none focus:ring-1 focus:ring-signal-500"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  We send a one-time code over SMS to verify. Standard rates apply.
                </p>
              </div>
              <div>
                <label
                  htmlFor="signup-email"
                  className="block text-sm font-semibold text-foreground"
                >
                  Email (optional)
                </label>
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="mt-2 block w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-signal-500 focus:outline-none focus:ring-1 focus:ring-signal-500"
                />
              </div>
              <div className="flex items-start gap-2">
                <input
                  id="signup-terms"
                  name="accept_terms"
                  type="checkbox"
                  required
                  className="mt-1 h-4 w-4 rounded border-border bg-background text-signal-500 focus:ring-signal-500"
                />
                <label htmlFor="signup-terms" className="text-xs leading-snug text-neutral-400">
                  I agree to the{' '}
                  <Link href="/terms" className="text-signal-500 underline-offset-4 hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-signal-500 underline-offset-4 hover:underline">
                    Privacy Notice
                  </Link>
                  .
                </label>
              </div>
              <button
                type="submit"
                className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-signal-500 px-5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-signal-400 active:scale-[0.98]"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Sign Up — free
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-neutral-400">
            Already have an account?{' '}
            <Link
              href="/sign-in"
              className="font-medium text-signal-500 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500 rounded-sm"
            >
              Log In
            </Link>
          </p>

          <p className="mt-8 inline-flex w-full items-center justify-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-widest text-neutral-500">
            <ShieldCheck className="h-3 w-3 text-signal-500" aria-hidden="true" />
            SOC 2 Type II · ISO 27001 · TZ DPA aligned
          </p>
        </div>
      </div>
    </PageShell>
  );
}
