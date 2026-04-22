import Link from 'next/link';
import { Wordmark } from '@bossnyumba/design-system';

/**
 * Marketing-site top navigation. Stripe-level restraint: single horizontal
 * row, subtle bottom border when scrolled, clear CTA hierarchy.
 */
export function Nav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link
          href="/"
          aria-label="Boss Nyumba home"
          className="-ml-1 rounded-sm p-1 transition-opacity duration-fast hover:opacity-80"
        >
          <Wordmark size="sm" premium />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {[
            { href: '/platform',  label: 'Platform' },
            { href: '/autonomy',  label: 'Autonomy' },
            { href: '/security',  label: 'Security' },
            { href: '/customers', label: 'Customers' },
            { href: '/pricing',   label: 'Pricing' },
            { href: '/docs',      label: 'Docs' },
          ].map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition-colors duration-fast hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition-colors duration-fast hover:bg-accent hover:text-foreground sm:inline-block"
          >
            Log in
          </Link>
          <Link
            href="/book-demo"
            className="rounded-md bg-signal-500 px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-fast ease-out hover:bg-signal-400 hover:shadow-md active:scale-[0.98]"
          >
            Book a demo
          </Link>
        </div>
      </nav>
    </header>
  );
}
