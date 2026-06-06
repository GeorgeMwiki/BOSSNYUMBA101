'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';

/**
 * Full-screen chat — for tenants who want the panel maximised. Same
 * AskPanel component, no header chrome.
 *
 * Performance: dynamic-imported `AskPanel` — see /page.tsx for rationale.
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
      className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6"
    >
      <div className="h-12 w-full animate-pulse rounded-chat bg-ink-muted/20" />
      <div className="h-72 w-full animate-pulse rounded-chat bg-ink-muted/10" />
    </div>
  );
}

export default function ChatPage() {
  return (
    <main className="flex min-h-screen flex-col bg-surface-subtle">
      <header className="flex items-center justify-between border-b border-ink-muted/10 bg-surface px-4 py-3">
        <Link href="/" className="text-sm text-ink-muted hover:text-brand">
          ← Back
        </Link>
        <span className="text-sm font-medium text-ink">Chat</span>
        <span className="text-sm text-ink-muted" />
      </header>
      <div className="flex-1 py-2">
        <AskPanel />
      </div>
    </main>
  );
}
