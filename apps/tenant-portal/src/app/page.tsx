import Link from 'next/link';
import { AskPanel } from '@/components/AskPanel';

/**
 * Tenant-portal landing — the chat panel IS the page. Everything else
 * is one tap away in the header.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-ink-muted/10 bg-surface px-4 py-3">
        <Link href="/" className="text-base font-semibold text-ink">
          BossNyumba
        </Link>
        <Link
          href="/chat"
          className="text-sm text-ink-muted hover:text-brand"
        >
          Open full chat →
        </Link>
      </header>
      <div className="flex-1 py-8">
        <AskPanel />
      </div>
      <footer className="border-t border-ink-muted/10 bg-surface px-4 py-2 text-center text-xs text-ink-muted">
        Powered by BossNyumba advisor
      </footer>
    </main>
  );
}
