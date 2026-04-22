'use client';

/**
 * ThreadSidebar — the 260px left rail.
 *
 * Shows the "Talk to your company" heading, a "New conversation" button,
 * and the list of recent threads with a time-ago stamp.
 *
 * Degraded: if the thread list failed to load, we render a compact
 * DegradedCard in place of the list. The sidebar itself still renders
 * so the new-conversation button remains usable.
 */

import Link from 'next/link';
import { MessageSquarePlus, Sparkles } from 'lucide-react';
import type { DegradedState, ThreadSummary } from './types';
import { DegradedCard } from './DegradedCard';

export interface ThreadSidebarProps {
  readonly threads: ReadonlyArray<ThreadSummary>;
  readonly activeThreadId: string | null;
  readonly degraded: DegradedState | null;
  readonly onRetry?: () => void;
  readonly onNewConversation: () => void;
}

export function ThreadSidebar(props: ThreadSidebarProps): JSX.Element {
  const { threads, activeThreadId, degraded, onRetry, onNewConversation } = props;

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[260px]">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-signal-500" />
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-signal-500">
            Ask
          </p>
        </div>
        <h1 className="mt-2 font-display text-2xl font-medium leading-tight tracking-tight">
          Talk to your company
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          I can see every unit, every tenant, every vendor, every decision
          I've made for you.
        </p>
      </div>

      <button
        type="button"
        onClick={onNewConversation}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-signal-500 px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-fast hover:bg-signal-400"
      >
        <MessageSquarePlus className="h-4 w-4" />
        New conversation
      </button>

      <div className="flex-1 min-h-0">
        <h2 className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
          Recent
        </h2>
        <div className="mt-3">
          {degraded ? (
            <DegradedCard
              reason={degraded.reason}
              message={degraded.message}
              onRetry={onRetry}
              compact
            />
          ) : threads.length === 0 ? (
            <p className="text-xs leading-relaxed text-neutral-500">
              Nothing yet. Start a conversation and I'll remember it here.
            </p>
          ) : (
            <ul className="space-y-1">
              {threads.map((thread) => {
                const isActive = thread.threadId === activeThreadId;
                return (
                  <li key={thread.threadId}>
                    <Link
                      href={`/ask/${encodeURIComponent(thread.threadId)}`}
                      className={[
                        'block rounded-md px-3 py-2 text-sm transition-colors duration-fast',
                        isActive
                          ? 'bg-signal-500/10 text-foreground'
                          : 'text-neutral-500 hover:bg-surface-raised hover:text-foreground',
                      ].join(' ')}
                    >
                      <div className="truncate text-sm font-medium text-foreground">
                        {thread.title || 'Untitled conversation'}
                      </div>
                      <div className="mt-0.5 flex items-baseline gap-2 font-mono text-[0.62rem] text-neutral-500">
                        <span>{formatTimeAgo(thread.updatedAt)}</span>
                        <span>·</span>
                        <span className="tabular-nums">
                          {thread.turnCount} {thread.turnCount === 1 ? 'turn' : 'turns'}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}

function formatTimeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const diffMs = Date.now() - then;
  const seconds = Math.max(0, Math.round(diffMs / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}
