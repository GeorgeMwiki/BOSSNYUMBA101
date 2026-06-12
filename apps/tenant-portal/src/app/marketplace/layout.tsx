import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';

/**
 * Marketplace layout — wraps every `/marketplace/*` page with the
 * sticky header (org switcher + nav). The chat-first surface owned by
 * P7 stays at the app root; the marketplace is its own browsing
 * sub-app under one shared layout.
 */
export default async function MarketplaceLayout({
  children,
}: {
  readonly children: ReactNode;
}): Promise<JSX.Element> {
  const t = await getTranslations('marketplace');
  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle">
      <MarketplaceHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-ink-muted/10 bg-surface px-4 py-3 text-center text-xs text-ink-muted">
        <Link href="/" className="hover:text-brand">
          {t('backToChat')}
        </Link>
      </footer>
    </div>
  );
}
