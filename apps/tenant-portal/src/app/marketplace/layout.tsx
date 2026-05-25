import type { ReactNode } from 'react';
import Link from 'next/link';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';

/**
 * Marketplace layout — wraps every `/marketplace/*` page with the
 * sticky header (org switcher + nav). The chat-first surface owned by
 * P7 stays at the app root; the marketplace is its own browsing
 * sub-app under one shared layout.
 */
export default function MarketplaceLayout({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle">
      <MarketplaceHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-ink-muted/10 bg-surface px-4 py-3 text-center text-xs text-ink-muted">
        <Link href="/" className="hover:text-brand">
          ← Back to chat
        </Link>
      </footer>
    </div>
  );
}
