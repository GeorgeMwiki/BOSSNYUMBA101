/**
 * /ask/[threadId] — the live thread view.
 *
 * Loads the thread + turns on mount, then renders the sidebar + the
 * thread canvas. The composer streams each new user message over SSE;
 * each AgentEvent is folded into an AgentTurnState that AgentTurn
 * renders live.
 *
 * The layout is a 3-column shell at ≥lg: sidebar / main canvas /
 * artifact pane. Everything collapses to stacked below lg.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Brain, Maximize2, ShieldCheck, Sparkles } from 'lucide-react';
import { AgentTurn } from '../_components/AgentTurn';
import { AuditTrailPanel } from '../_components/AuditTrailPanel';
import { DegradedCard } from '../_components/DegradedCard';
import { ThreadSidebar } from '../_components/ThreadSidebar';
import {
  getThread,
  listThreads,
  streamMessage,
} from '../_components/api';
import {
  applyEvent,
  emptyAgentTurn,
} from '../_components/turn-reducer';
import type {
  AgentTurnState,
  Artifact,
  Citation,
  DegradedState,
  StoredTurn,
  ThreadSummary,
  TurnState,
} from '../_components/types';

export default function ThreadPage() {
  const params = useParams<{ threadId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const threadId = params?.threadId ?? '';
  const seedMessage = searchParams?.get('seed') ?? null;

  const [threads, setThreads] = useState<ReadonlyArray<ThreadSummary>>([]);
  const [threadTitle, setThreadTitle] = useState<string>('');
  const [turns, setTurns] = useState<ReadonlyArray<TurnState>>([]);
  const [degraded, setDegraded] = useState<DegradedState | null>(null);
  const [composerValue, setComposerValue] = useState('');
  const [extendedThinking, setExtendedThinking] = useState(false);
  const [isStreaming, setStreaming] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [rightPane, setRightPane] = useState<'artifacts' | 'audit'>('artifacts');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seededRef = useRef(false);

  // Load sidebar thread list + current thread contents.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [listResult, threadResult] = await Promise.all([
        listThreads(),
        getThread(threadId),
      ]);
      if (cancelled) return;
      if (listResult.ok) setThreads(listResult.data);
      if (threadResult.ok) {
        setThreadTitle(threadResult.data.thread.title);
        setTurns(threadResult.data.turns.map(storedToTurnState));
        setDegraded(null);
      } else if (threadResult.status === 404) {
        setDegraded({
          reason: 'unknown',
          message: "I don't recognise that conversation — it isn't one of yours.",
          status: 404,
        });
      } else {
        setDegraded({
          reason: threadResult.reason,
          message: threadResult.message,
          status: threadResult.status,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  // Auto-scroll on turn/text update
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [turns]);

  const appendUserTurn = useCallback((content: string) => {
    setTurns((prev) => [
      ...prev,
      {
        role: 'user' as const,
        turn: { turnId: `local_${Date.now()}`, content },
      },
    ]);
  }, []);

  const streamAgentTurn = useCallback(
    async (userMessage: string) => {
      setStreaming(true);
      const abort = new AbortController();
      abortRef.current = abort;
      const liveTurnId = `live_${Date.now()}`;
      let state = emptyAgentTurn(liveTurnId);
      setTurns((prev) => [...prev, { role: 'agent', turn: state }]);

      try {
        for await (const event of streamMessage({
          threadId,
          userMessage,
          extendedThinking,
          signal: abort.signal,
        })) {
          state = applyEvent(state, event);
          const snapshot = state;
          setTurns((prev) => {
            const next = prev.slice();
            const last = next[next.length - 1];
            if (last && last.role === 'agent') {
              next[next.length - 1] = { role: 'agent', turn: snapshot };
            }
            return next;
          });
          if (event.kind === 'done' || event.kind === 'error') break;
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [extendedThinking, threadId],
  );

  // Auto-fire the seed message once on first render (only when the
  // URL carries a ?seed= query param from the landing page).
  useEffect(() => {
    if (seededRef.current) return;
    if (!seedMessage) return;
    if (isStreaming) return;
    if (degraded) return;
    // Guard: only seed when the thread has exactly one user turn (the
    // seed itself, from createThread), so we don't double-fire.
    if (turns.length !== 1) return;
    seededRef.current = true;
    void streamAgentTurn(seedMessage);
  }, [seedMessage, turns, isStreaming, degraded, streamAgentTurn]);

  const handleSend = useCallback(async () => {
    const value = composerValue.trim();
    if (value.length === 0 || isStreaming) return;
    setComposerValue('');
    appendUserTurn(value);
    await streamAgentTurn(value);
  }, [composerValue, isStreaming, appendUserTurn, streamAgentTurn]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleStop = (): void => {
    abortRef.current?.abort();
  };

  const handleExpandArtifact = (artifact: Artifact): void => {
    setSelectedArtifact(artifact);
  };

  const handleFocusCitation = (_citation: Citation): void => {
    // Future: scroll the artifact pane to show the citation's target.
    // For now just select the first artifact referencing this citation.
  };

  const aggregatedCitations = useMemo<ReadonlyArray<Citation>>(() => {
    const all: Citation[] = [];
    for (const t of turns) {
      if (t.role === 'agent') all.push(...t.turn.citations);
    }
    return all;
  }, [turns]);

  return (
    <div className="flex min-h-screen bg-background">
      <ThreadSidebar
        threads={threads}
        activeThreadId={threadId}
        degraded={null}
        onNewConversation={() => router.push('/ask')}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-start justify-between gap-4 border-b border-border px-8 py-5">
          <div className="min-w-0">
            <p className="font-mono text-[0.68rem] uppercase tracking-widest text-signal-500">
              Conversation
            </p>
            <h1 className="mt-1 truncate font-display text-2xl font-medium tracking-tight">
              {threadTitle || 'Loading…'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setRightPane((p) => (p === 'audit' ? 'artifacts' : 'audit'))
              }
              className={[
                'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-fast',
                rightPane === 'audit'
                  ? 'border-signal-500/60 bg-signal-500/10 text-signal-500'
                  : 'border-border text-neutral-500 hover:bg-surface-raised hover:text-foreground',
              ].join(' ')}
              aria-pressed={rightPane === 'audit'}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Audit trail
            </button>
            <button
              type="button"
              onClick={() => router.push('/ask')}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-neutral-500 transition-colors duration-fast hover:bg-surface-raised hover:text-foreground"
            >
              New conversation
            </button>
          </div>
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
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-8 py-8"
          >
            <div className="mx-auto max-w-3xl space-y-6">
              {turns.map((t, i) =>
                t.role === 'user' ? (
                  <UserBubble key={`${t.turn.turnId}-${i}`} content={t.turn.content} />
                ) : (
                  <AgentTurn
                    key={`${t.turn.turnId}-${i}`}
                    state={t.turn}
                    onExpandArtifact={handleExpandArtifact}
                    onFocusCitation={handleFocusCitation}
                  />
                ),
              )}
              {turns.length === 0 && (
                <div className="rounded-xl border border-border bg-surface p-10 text-center">
                  <p className="text-sm text-neutral-500">Loading conversation…</p>
                </div>
              )}
            </div>
          </div>
        )}

        <footer className="border-t border-border bg-surface px-8 py-4">
          <form
            className="mx-auto flex max-w-3xl items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            <div className="flex-1">
              <textarea
                value={composerValue}
                onChange={(e) => setComposerValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isStreaming ? 'I&apos;m still answering…' : 'Ask me another…'}
                rows={1}
                disabled={isStreaming}
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 font-sans text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setExtendedThinking((v) => !v)}
                  disabled={isStreaming}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[0.65rem] transition-colors duration-fast',
                    extendedThinking
                      ? 'border-signal-500/60 bg-signal-500/10 text-signal-500'
                      : 'border-border text-neutral-500 hover:border-signal-700/60 hover:text-foreground',
                  ].join(' ')}
                  aria-pressed={extendedThinking}
                >
                  <Brain className="h-3 w-3" />
                  {extendedThinking ? 'Extended thinking on' : 'Extended thinking'}
                </button>
              </div>
            </div>
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border px-4 text-sm font-semibold text-foreground transition-colors duration-fast hover:bg-surface-raised"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={composerValue.trim().length === 0 || degraded !== null}
                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-signal-500 px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors duration-fast hover:bg-signal-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Send
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </form>
        </footer>
      </main>

      {rightPane === 'audit' ? (
        <aside className="hidden w-[360px] shrink-0 border-l border-border bg-surface lg:block">
          <AuditTrailPanel
            threadId={threadId}
            scope="tenant"
            fetchUrl={buildAuditUrl(threadId)}
            title={threadTitle || undefined}
          />
        </aside>
      ) : (
        <ArtifactPane
          artifact={selectedArtifact}
          onClose={() => setSelectedArtifact(null)}
          citations={aggregatedCitations}
        />
      )}
    </div>
  );
}

function buildAuditUrl(threadId: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
  const path = `/api/v1/intelligence/thread/${encodeURIComponent(threadId)}/audit?scope=tenant&limit=500`;
  return base ? `${base}${path}` : path;
}

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────

function UserBubble({ content }: { readonly content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] rounded-2xl rounded-br-md bg-signal-500 px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
        {content}
      </div>
    </div>
  );
}

function ArtifactPane({
  artifact,
  citations,
  onClose,
}: {
  readonly artifact: Artifact | null;
  readonly citations: ReadonlyArray<Citation>;
  readonly onClose: () => void;
}) {
  return (
    <aside className="hidden w-[320px] shrink-0 border-l border-border bg-surface lg:flex lg:flex-col">
      <header className="flex items-start justify-between gap-2 border-b border-border px-5 py-4">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-widest text-neutral-500">
            {artifact ? 'Artifact' : 'Citations'}
          </p>
          <h2 className="mt-1 truncate font-display text-base font-medium tracking-tight">
            {artifact ? artifact.title : 'This conversation'}
          </h2>
        </div>
        {artifact && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-neutral-500 transition-colors duration-fast hover:bg-accent hover:text-foreground"
            aria-label="Close artifact"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {artifact ? (
          <pre className="overflow-auto rounded-md bg-background p-3 font-mono text-[0.68rem] text-neutral-500">
            {JSON.stringify(artifact.data, null, 2)}
          </pre>
        ) : citations.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-neutral-500">
            <Sparkles className="h-3 w-3 text-signal-500" />
            Citations I use in this conversation will collect here.
          </p>
        ) : (
          <ul className="space-y-2">
            {citations.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-border bg-background px-3 py-2 text-xs"
              >
                <div className="font-medium text-foreground">{c.label}</div>
                <div className="mt-1 flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-widest text-neutral-500">
                  <span>{c.target.kind}</span>
                  <span>·</span>
                  <span className="tabular-nums">{Math.round(c.confidence * 100)}%</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function storedToTurnState(stored: StoredTurn): TurnState {
  if (stored.role === 'user') {
    return {
      role: 'user',
      turn: { turnId: stored.turnId, content: stored.content },
    };
  }
  const state: AgentTurnState = {
    turnId: stored.turnId,
    status: 'done',
    plan: null,
    thoughts: [],
    toolCalls: [],
    text: stored.content,
    citations: stored.citations,
    artifacts: stored.artifacts,
    error: null,
    totalMs: null,
  };
  return { role: 'agent', turn: state };
}
