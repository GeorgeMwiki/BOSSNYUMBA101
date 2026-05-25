import Link from 'next/link';
import dynamic from 'next/dynamic';

/**
 * Tenant-portal landing — the chat panel IS the page. Everything else
 * is one tap away in the header.
 *
 * Performance: `AskPanel` (199 lines + streaming-fetch + chip API
 * client) is dynamic-imported so the landing header + footer paint
 * immediately. `ssr: false` because the panel relies on streaming
 * fetch + local session state that only run on the client.
 */
const AskPanel = dynamic(
  () => import('@/components/AskPanel').then((m) => ({ default: m.AskPanel })),
  {
    ssr: false,
    loading: () => <AskPanelSkeleton />,
  },
);

function AskPanelSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading chat panel"
      className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4"
    >
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-ink-muted/20" />
        ))}
      </div>
      <div className="h-12 w-full animate-pulse rounded-chat bg-ink-muted/20" />
      <div className="h-48 w-full animate-pulse rounded-chat bg-ink-muted/10" />
    </div>
  );
}

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
