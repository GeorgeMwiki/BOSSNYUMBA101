'use client';

/**
 * JarvisConsole — minimal chat console wired into the platform-tier
 * Jarvis surface. Uses the shared `useJarvis` hook and the
 * `createJarvisClient` factory from the api-sdk so every BossNyumba
 * frontend can reuse the same primitive.
 */

import { useMemo, useState } from 'react';
import { createBossnyumbaClient, createJarvisClient } from '@bossnyumba/api-sdk';
import { useJarvis } from '@bossnyumba/chat-ui';

const DEFAULT_GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:4000';

export function JarvisConsole(): JSX.Element {
  const [draft, setDraft] = useState('');
  const [threadId] = useState(() => `hq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const client = useMemo(
    () =>
      createJarvisClient(
        createBossnyumbaClient({
          baseUrl: DEFAULT_GATEWAY,
          // Bearer comes from the existing Supabase auth session in the
          // page wrapper; the gateway middleware also accepts an
          // X-API-Key for service-to-service in dev.
          bearerToken: () => readBearerFromCookie(),
        }),
        'platform',
      ),
    [],
  );

  const { turns, status, error, persona, think, reset } = useJarvis({
    client,
    threadId,
    defaultStakes: 'medium',
    defaultTier: 'industry',
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const text = draft.trim();
    if (!text || status === 'thinking') return;
    setDraft('');
    await think(text);
  }

  return (
    <div className="flex flex-col gap-4">
      {persona ? (
        <div className="rounded border border-border bg-surface-sunken px-4 py-2 text-sm text-muted-foreground">
          {persona.displayName} · {persona.firstPersonNoun === 'we' ? 'plural voice' : 'singular voice'}
        </div>
      ) : null}

      <div className="flex min-h-[60vh] flex-col gap-3 rounded border border-border bg-surface p-4 overflow-y-auto">
        {turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask Nyumba Mind anything about the platform — collection trends, vacancy drift,
            arrears patterns. Every claim is grounded in DP-aggregate evidence.
          </p>
        ) : (
          turns.map((t) => (
            <div
              key={t.id}
              className={
                t.role === 'user'
                  ? 'self-end max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground'
                  : 'self-start max-w-[80%] rounded-lg bg-surface-sunken px-3 py-2 text-sm text-foreground'
              }
            >
              <div className="whitespace-pre-wrap">{t.text}</div>
              {t.role === 'assistant' && t.decision?.confidence ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  confidence {(t.decision.confidence.overall * 100).toFixed(0)}%
                  {t.decision.kind === 'softened' ? ' · softened' : ''}
                  {t.decision.kind === 'refusal' ? ' · refused' : ''}
                </div>
              ) : null}
            </div>
          ))
        )}
        {status === 'thinking' ? (
          <div className="self-start text-xs text-muted-foreground italic">thinking…</div>
        ) : null}
        {error ? (
          <div className="self-start text-xs text-destructive">error: {error}</div>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask Nyumba Mind…"
          disabled={status === 'thinking'}
          className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={status === 'thinking' || !draft.trim()}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Send
        </button>
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

function readBearerFromCookie(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/sb-access-token=([^;]+)/);
  return m ? decodeURIComponent(m[1] ?? '') : '';
}
