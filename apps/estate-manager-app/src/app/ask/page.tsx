/**
 * /ask — Talk to your company.
 *
 * Landing surface: loads the authed user's past threads via the
 * authenticated gateway, renders the sidebar, and shows an empty-
 * canvas empty state inviting a new conversation. Creating a thread
 * redirects to /ask/[threadId].
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Sparkles } from 'lucide-react';
import { DegradedCard } from './_components/DegradedCard';
import { ThreadSidebar } from './_components/ThreadSidebar';
import { createThread, listThreads } from './_components/api';
import type { DegradedState, ThreadSummary } from './_components/types';

const STARTER_PROMPTS: ReadonlyArray<string> = [
  'Which vendors are my weak points this quarter?',
  'Show me everyone who is 30+ days late.',
  'Where is occupancy drifting down?',
  'What does my renewal cohort look like for May?',
];

export default function AskLandingPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<ReadonlyArray<ThreadSummary>>([]);
  const [degraded, setDegraded] = useState<DegradedState | null>(null);
  const [, setLoadingThreads] = useState(true);
  const [composerValue, setComposerValue] = useState('');
  const [isStarting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Fetch thread list on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await listThreads();
      if (cancelled) return;
      if (result.ok) {
        setThreads(result.data);
        setDegraded(null);
      } else {
        setThreads([]);
        setDegraded({
          reason: result.reason,
          message: result.message,
          status: result.status,
        });
      }
      setLoadingThreads(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStart = useCallback(
    async (seed?: string) => {
      const value = (seed ?? composerValue).trim();
      if (value.length === 0) return;
      setStarting(true);
      setStartError(null);
      const result = await createThread(value);
      if (result.ok) {
        router.push(`/ask/${encodeURIComponent(result.data.threadId)}?seed=${encodeURIComponent(value)}`);
      } else {
        setStartError(result.message);
        setStarting(false);
      }
    },
    [composerValue, router],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleStart();
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <ThreadSidebar
        threads={threads}
        activeThreadId={null}
        degraded={degraded}
        onRetry={() => router.refresh()}
        onNewConversation={() => textareaRef.current?.focus()}
      />

      <main className="flex-1 flex flex-col">
        <header className="border-b border-border px-8 py-6">
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-signal-500">
            Central intelligence
          </p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground">
            Talk to your company
          </h1>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-neutral-500">
            I am the estate. Ask me anything. I can see every unit, every
            tenant, every vendor, every decision I made for you — and I will
            cite every claim.
          </p>
        </header>

        {degraded ? (
          <div className="flex-1 px-8 py-12">
            <DegradedCard
              reason={degraded.reason}
              message={degraded.message}
              onRetry={() => router.refresh()}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-8 py-12">
            <div className="mx-auto max-w-3xl">
              <div className="rounded-2xl border border-border bg-surface p-10 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-signal-500/10 text-signal-500">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className="mt-6 font-display text-2xl font-medium tracking-tight">
                  We haven&apos;t spoken yet today.
                </h2>
                <p className="mx-auto mt-3 max-w-[52ch] text-sm leading-relaxed text-neutral-500">
                  Start with a question, or pick one of these.
                </p>

                <ul className="mt-8 grid gap-2 text-left sm:grid-cols-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <li key={prompt}>
                      <button
                        type="button"
                        onClick={() => void handleStart(prompt)}
                        disabled={isStarting}
                        className="group w-full rounded-lg border border-border bg-background px-4 py-3 text-left text-sm text-foreground transition-colors duration-fast hover:border-signal-700 hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span>{prompt}</span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform duration-fast group-hover:translate-x-0.5 group-hover:text-signal-500" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                {startError && (
                  <p className="mx-auto mt-6 max-w-prose rounded-md border border-danger/40 bg-danger-subtle px-3 py-2 text-sm text-danger">
                    {startError}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <footer className="border-t border-border bg-surface px-8 py-4">
          <form
            className="mx-auto flex max-w-3xl items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handleStart();
            }}
          >
            <label className="sr-only" htmlFor="ask-composer">
              Ask the estate
            </label>
            <textarea
              id="ask-composer"
              ref={textareaRef}
              value={composerValue}
              onChange={(e) => setComposerValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about the estate…"
              rows={1}
              className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 font-sans text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={isStarting || composerValue.trim().length === 0 || degraded !== null}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-signal-500 px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors duration-fast hover:bg-signal-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isStarting ? 'Starting…' : 'Send'}
              {!isStarting && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}
