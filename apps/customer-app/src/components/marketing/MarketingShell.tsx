'use client';

/**
 * MarketingShell — shared layout chrome for the product-content pages
 * (for-owners, for-tenants, for-managers, for-station-masters, pricing,
 * how-it-works, compare). The floating Mr. Mwikila widget is mounted at
 * the root layout so it is already present — we only render navigation,
 * hero, and a persistent "Ask Mr. Mwikila" CTA that opens the widget.
 */

import Link from 'next/link';

interface Props {
  readonly title: string;
  readonly subtitle: string;
  readonly heroCtaLabel: string;
  readonly children: React.ReactNode;
}

const NAV_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/for-owners', label: 'Owners' },
  { href: '/for-tenants', label: 'Tenants' },
  { href: '/for-managers', label: 'Managers' },
  { href: '/for-station-masters', label: 'Station Masters' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/compare', label: 'Compare' },
];

export function MarketingShell({ title, subtitle, heroCtaLabel, children }: Props) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            BOSSNYUMBA
          </Link>
          <nav className="hidden gap-4 md:flex">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-slate-700 hover:text-emerald-700">
                {l.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/"
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Launch chat
          </Link>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-700">{subtitle}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              {heroCtaLabel}
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-emerald-500"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12">{children}</div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-600">
          BOSSNYUMBA — built for East African estate owners, tenants, managers, and station masters.
          Ask Mr. Mwikila anything. Data stays on your side.
        </div>
      </footer>
    </main>
  );
}
