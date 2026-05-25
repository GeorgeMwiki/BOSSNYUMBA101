import Link from 'next/link';
import { AskPanel } from '@/components/AskPanel';

/**
 * Full-screen chat — for tenants who want the panel maximised. Same
 * AskPanel component, no header chrome.
 */
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
