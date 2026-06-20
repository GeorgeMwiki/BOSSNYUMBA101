/**
 * OwnerJarvisShell — owner-flavoured chat surface for Mr. Mwikila.
 *
 * Wraps `chat-ui`'s `useJarvisStream` + `useJarvis` hooks with:
 *   - the owner-tier surface client (`createJarvisClient(..., 'owner')`)
 *   - `tool_output_available` → `uiParts[]` plumbing already lives in
 *     the chat-ui hook; this shell just renders each part through a
 *     minimal AdaptiveRenderer-style dispatcher
 *   - FeedbackThumbs on every assistant turn (shared gateway feedback
 *     wire, with a surface-local copy of the widget)
 *
 * The owner-portal is Vite (not Next.js) so this component is plain
 * React with no `use client` directive. The Vite-only Jarvis page
 * imports the shell directly.
 *
 * Compact by design — owner-portal's existing `pages/Jarvis.tsx` ships
 * the full streaming + voice + vision feature set. The shell exists so
 * the new owner home (`src/app/page.tsx`) can drop in a chat surface
 * without re-implementing the auth + streaming wiring.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createBossnyumbaClient, createJarvisClient } from '@bossnyumba/api-sdk';
import { useJarvisStream, useChatScroll } from '@bossnyumba/chat-ui';
import { AdaptiveRenderer, type AgUiUiPart } from '@bossnyumba/genui';
import { FeedbackThumbs, type FeedbackVerdict } from './FeedbackThumbs';
import { getCsrfHeaders } from '@/lib/csrf';

// Build-time guard: production builds MUST define VITE_API_URL. Vite
// inlines `import.meta.env.MODE` and `import.meta.env.PROD` so the
// production guard collapses to a constant `true` in a prod bundle —
// any deployer that forgets the env var sees a loud boot error instead
// of the shell silently calling localhost:4000.
function resolveGatewayUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (import.meta.env.PROD) {
    throw new Error(
      'VITE_API_URL is required in production builds of owner-portal.',
    );
  }
  return 'http://localhost:4000';
}
const DEFAULT_GATEWAY = resolveGatewayUrl();

export interface OwnerJarvisShellProps {
  /**
   * Optional surface label shown at the top of the panel. Defaults to
   * "Portfolio Concierge".
   */
  readonly title?: string;
  /**
   * Optional placeholder for the input. Defaults to a context-aware
   * owner prompt.
   */
  readonly placeholder?: string;
  /**
   * Optional "compact" flag — drops the title bar so the shell can be
   * inlined into a section card.
   */
  readonly compact?: boolean;
}

function readBearer(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem('token') ?? '';
  } catch {
    return '';
  }
}

interface OwnerSeededTool {
  readonly name: string;
  readonly headline: string;
}

/**
 * The 5 owner-tier brain tools the kernel registers at boot. Shown as
 * pill suggestions so the owner can fire a canned ask without typing.
 * Kept in sync with `OWNER_TOOL_NAMES` in
 * `packages/central-intelligence/src/kernel/tool-spec/owner-tools/index.ts`.
 */
const OWNER_TOOL_SUGGESTIONS: ReadonlyArray<OwnerSeededTool> = Object.freeze([
  { name: 'owner.next_actions', headline: 'What should I focus on today?' },
  { name: 'owner.list_arrears', headline: 'Who is in arrears right now?' },
  { name: 'owner.show_occupancy', headline: 'How is occupancy this week?' },
  {
    name: 'owner.financial_summary',
    headline: 'Show me the cashflow for the last 12 months.',
  },
  {
    name: 'owner.draft_eviction_notice',
    headline: 'Draft an eviction notice for Unit A-101.',
  },
]);

export function OwnerJarvisShell({
  title,
  placeholder,
  compact = false,
}: OwnerJarvisShellProps): JSX.Element {
  const t = useTranslations('p89.jarvisShell');
  const [draft, setDraft] = useState('');
  const [threadId] = useState(
    () => `own_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`,
  );

  const client = useMemo(
    () =>
      createJarvisClient(
        createBossnyumbaClient({
          baseUrl: DEFAULT_GATEWAY,
          bearerToken: () => readBearer(),
        }),
        'owner',
      ),
    [],
  );

  const { turns, status, error, startStream, abort, reset } = useJarvisStream({
    client,
    threadId,
    defaultStakes: 'medium',
  });

  const isStreaming = status === 'streaming';

  const handleFeedback = useCallback(
    async (
      turnId: string,
      verdict: FeedbackVerdict,
      reason?: string,
    ): Promise<void> => {
      const response = await fetch(`${DEFAULT_GATEWAY}/api/v1/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${readBearer()}`,
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({
          turnId,
          threadId,
          signal: verdict === 'up' ? 'thumbs-up' : 'thumbs-down',
          correctionText: reason ?? null,
        }),
      });
      if (!response.ok) {
        throw new Error(`Feedback failed (${response.status})`);
      }
    },
    [threadId],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      const text = draft.trim();
      if (!text || isStreaming) return;
      setDraft('');
      await startStream(text);
    },
    [draft, isStreaming, startStream],
  );

  const handleSuggestion = useCallback(
    (headline: string): void => {
      if (isStreaming) return;
      void startStream(headline);
    },
    [isStreaming, startStream],
  );

  const transcriptRef = useRef<HTMLDivElement>(null);
  // Canonical streaming-scroll behaviour (§5.1): follow only while the reader is
  // at the bottom, instant during stream, never yank a reader who scrolled up.
  useChatScroll(transcriptRef, turns, isStreaming);

  return (
    <div className="flex flex-col gap-3">
      {!compact ? (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {title ?? 'Portfolio Concierge'}
          </h2>
          <span className="rounded-full border border-border bg-surface-sunken px-2 py-1 text-xs text-muted-foreground">
            owner-tier · streaming
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {OWNER_TOOL_SUGGESTIONS.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={(): void => handleSuggestion(s.headline)}
            disabled={isStreaming}
            className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-foreground hover:bg-surface-sunken disabled:opacity-50"
            title={s.name}
          >
            {s.headline}
          </button>
        ))}
      </div>

      <div
        ref={transcriptRef}
        data-owner-jarvis-transcript
        className="flex min-h-[40vh] flex-col gap-3 overflow-y-auto rounded border border-border bg-surface p-4"
      >
        {turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask Mr. Mwikila about your portfolio — arrears, occupancy, cashflow,
            or what to focus on today. Every claim is grounded in your own
            tenant data.
          </p>
        ) : (
          turns.map((t) => (
            <OwnerJarvisTurn
              key={t.id}
              turn={t}
              onFeedback={handleFeedback}
            />
          ))
        )}
        {isStreaming ? (
          <div className="self-start text-xs italic text-muted-foreground">
            streaming…
          </div>
        ) : null}
        {error ? (
          <div className="self-start text-xs text-destructive">
            error: {error}
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e): void => setDraft(e.target.value)}
          placeholder={placeholder ?? 'Ask Mr. Mwikila about your portfolio…'}
          disabled={isStreaming}
          className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          aria-label={t('inputAria')}
        />
        <button
          type="submit"
          disabled={isStreaming || draft.trim().length === 0}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Send
        </button>
        {isStreaming ? (
          <button
            type="button"
            onClick={abort}
            className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            Abort
          </button>
        ) : null}
        <button
          type="button"
          onClick={reset}
          disabled={turns.length === 0}
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:opacity-50"
        >
          Clear
        </button>
      </form>
    </div>
  );
}

interface OwnerJarvisTurnProps {
  readonly turn: import('@bossnyumba/chat-ui').JarvisStreamTurn;
  readonly onFeedback: (
    turnId: string,
    verdict: FeedbackVerdict,
    reason?: string,
  ) => Promise<void>;
}

/**
 * Owner-tier turn renderer. Uses the shared `@bossnyumba/genui`
 * `AdaptiveRenderer` so the owner sees the same typed AG-UI primitives
 * (chart-vega, data-table, kpi-grid, timeline, …) as the platform-tier
 * Jarvis surface. Before ProdFix-4 this rendered `uiPart.kind` as a
 * chip — owner-portal could see that a chart was emitted but not what
 * it contained.
 */
function OwnerJarvisTurn({ turn, onFeedback }: OwnerJarvisTurnProps): JSX.Element {
  const decision = turn.finalDecision;
  const uiParts: ReadonlyArray<AgUiUiPart> =
    (turn.uiParts as ReadonlyArray<AgUiUiPart> | undefined) ?? [];
  return (
    <div
      className={
        turn.role === 'user'
          ? 'self-end max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground'
          : 'self-start max-w-[80%] rounded-lg bg-surface-sunken px-3 py-2 text-sm text-foreground'
      }
    >
      <div className="whitespace-pre-wrap">{turn.text}</div>
      {turn.role === 'assistant' && uiParts.length > 0 ? (
        <div className="mt-2 flex flex-col gap-2">
          <AdaptiveRenderer parts={uiParts} />
        </div>
      ) : null}
      {turn.role === 'assistant' && decision?.confidence ? (
        <div className="mt-1 text-xs text-muted-foreground">
          confidence {(decision.confidence.overall * 100).toFixed(0)}%
          {decision.kind === 'softened' ? ' · softened' : ''}
          {decision.kind === 'refusal' ? ' · refused' : ''}
        </div>
      ) : null}
      {turn.role === 'assistant' ? (
        <FeedbackThumbs
          turnId={turn.id}
          onFeedback={(verdict, reason): Promise<void> =>
            onFeedback(turn.id, verdict, reason)
          }
        />
      ) : null}
    </div>
  );
}
