'use client';

/**
 * JarvisConsole — chat console for the manager-tier Jarvis surface.
 *
 * Parity with admin-platform-portal Jarvis: persona greeting, citations,
 * confidence + decision-kind metadata, image attachments, and Web Speech
 * voice I/O. Uses the shared `useJarvis` / `useJarvisStream` hooks and
 * `createJarvisClient` factory from the api-sdk so every BossNyumba
 * frontend reuses the same primitives.
 *
 * Stream is the default mode so first-token latency is visible
 * immediately while a manager triages a busy day. The toggle is
 * preserved so the single-shot /think path is one click away.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBossnyumbaClient, createJarvisClient } from '@bossnyumba/api-sdk';
import {
  MicButton,
  createWebSpeechAudioPort,
  useJarvis,
  useJarvisStream,
  type VoiceAudioPort,
} from '@bossnyumba/chat-ui';

const DEFAULT_GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:4000';

// UI-side cap. The gateway enforces 10 / 4 MiB per attachment as the hard
// server-side limit; the console intentionally caps lower so a manager
// does not staple a presentation deck onto a chat turn.
const MAX_IMAGES_PER_TURN = 5;
const ALLOWED_IMAGE_MIME = 'image/png,image/jpeg,image/gif,image/webp';

const MODE_STORAGE_KEY = 'bossnyumba.jarvis.mode';
type JarvisMode = 'stream' | 'single-shot';

function readStoredMode(): JarvisMode {
  if (typeof window === 'undefined') return 'stream';
  try {
    const raw = window.localStorage.getItem(MODE_STORAGE_KEY);
    return raw === 'single-shot' ? 'single-shot' : 'stream';
  } catch {
    return 'stream';
  }
}

export function JarvisConsole(): JSX.Element {
  const [draft, setDraft] = useState('');
  const [threadId] = useState(() => `mgr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [pendingImages, setPendingImages] = useState<ReadonlyArray<File>>([]);
  // Default to streaming so managers see token deltas the moment the
  // model commits to a direction. Preference is restored from
  // localStorage so the choice survives reloads.
  const [mode, setMode] = useState<JarvisMode>(() => readStoredMode());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateMode = useCallback((next: JarvisMode): void => {
    setMode(next);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable (private mode quota); ignore.
    }
  }, []);

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
        'manager',
      ),
    [],
  );

  // Voice port — instantiated only on the client (Web Speech needs `window`).
  const [audioPort, setAudioPort] = useState<VoiceAudioPort | null>(null);
  useEffect(() => {
    setAudioPort(createWebSpeechAudioPort());
  }, []);

  const {
    turns: singleShotTurns,
    status: singleShotStatus,
    error: singleShotError,
    persona,
    think,
    thinkWithAttachments,
    reset: singleShotReset,
    isListening,
    startListening,
    stopListening,
  } = useJarvis({
    client,
    threadId,
    defaultStakes: 'medium',
    defaultTier: 'property',
    ...(audioPort ? { voice: { audio: audioPort, speakReplies: true } } : {}),
  });

  // Streaming variant — same surface client; visibly faster UX because
  // each `delta` event is rendered as it arrives rather than waiting
  // for the full /think round-trip.
  const {
    turns: streamTurns,
    status: streamStatus,
    error: streamError,
    startStream,
    abort: abortStream,
    reset: streamReset,
  } = useJarvisStream({
    client,
    threadId,
    defaultStakes: 'medium',
    defaultTier: 'property',
  });

  const isStreaming = mode === 'stream';
  const turns = isStreaming ? streamTurns : singleShotTurns;
  const error = isStreaming ? streamError : singleShotError;
  const isThinking = isStreaming
    ? streamStatus === 'streaming'
    : singleShotStatus === 'thinking';
  const reset = isStreaming ? streamReset : singleShotReset;
  const streamPersona = streamTurns
    .slice()
    .reverse()
    .find((t) => t.role === 'assistant')?.persona;
  const visiblePersona = isStreaming ? (streamPersona ?? persona) : persona;

  function onPickImages(e: React.ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setPendingImages((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}::${f.size}`));
      const merged: File[] = [...prev];
      for (const f of files) {
        const k = `${f.name}::${f.size}`;
        if (!seen.has(k)) {
          merged.push(f);
          seen.add(k);
        }
      }
      return merged.slice(0, MAX_IMAGES_PER_TURN);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeImage(idx: number): void {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const text = draft.trim();
    if (isThinking) return;
    if (!text && pendingImages.length === 0) return;
    setDraft('');
    const images = pendingImages;
    setPendingImages([]);
    if (isStreaming) {
      await startStream(text, images.length > 0 ? images : undefined);
      return;
    }
    if (images.length > 0) {
      await thinkWithAttachments(text, images);
    } else {
      await think(text);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {visiblePersona ? (
            <div className="rounded border border-border bg-surface-sunken px-4 py-2 text-sm text-muted-foreground">
              {visiblePersona.displayName} ·{' '}
              {visiblePersona.firstPersonNoun === 'we' ? 'plural voice' : 'singular voice'}
            </div>
          ) : null}
          <span
            className="rounded-full border border-border bg-surface-sunken px-2 py-1 text-xs text-muted-foreground"
            aria-label={isStreaming ? 'Streaming mode active' : 'Single-shot mode active'}
          >
            {isStreaming ? '⚡ Live' : '📦 Single-shot'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Mode</span>
          <button
            type="button"
            onClick={() => updateMode('stream')}
            className={
              mode === 'stream'
                ? 'rounded border border-primary bg-primary px-2 py-1 text-primary-foreground'
                : 'rounded border border-border bg-surface px-2 py-1 text-foreground'
            }
            aria-pressed={mode === 'stream'}
          >
            stream
          </button>
          <button
            type="button"
            onClick={() => updateMode('single-shot')}
            className={
              mode === 'single-shot'
                ? 'rounded border border-primary bg-primary px-2 py-1 text-primary-foreground'
                : 'rounded border border-border bg-surface px-2 py-1 text-foreground'
            }
            aria-pressed={mode === 'single-shot'}
          >
            single-shot
          </button>
        </div>
      </div>

      <div className="flex min-h-[60vh] flex-col gap-3 rounded border border-border bg-surface p-4 overflow-y-auto">
        {turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask your Property Concierge anything about your portfolio — collection trends,
            vacancy drift, tenant arrears. Every claim is grounded in real evidence.
          </p>
        ) : (
          turns.map((t) => {
            // The single-shot turn carries `decision`; the streaming
            // turn carries `finalDecision`. Coalesce so the renderer
            // stays mode-agnostic.
            const tt = t as { decision?: any; finalDecision?: any } & typeof t;
            const decision = tt.finalDecision ?? tt.decision;
            return (
              <div
                key={t.id}
                className={
                  t.role === 'user'
                    ? 'self-end max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground'
                    : 'self-start max-w-[80%] rounded-lg bg-surface-sunken px-3 py-2 text-sm text-foreground'
                }
              >
                <div className="whitespace-pre-wrap">{t.text}</div>
                {t.role === 'assistant' && decision?.confidence ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    confidence {(decision.confidence.overall * 100).toFixed(0)}%
                    {decision.kind === 'softened' ? ' · softened' : ''}
                    {decision.kind === 'refusal' ? ' · refused' : ''}
                  </div>
                ) : null}
                {t.role === 'assistant' &&
                decision?.citations &&
                decision.citations.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {decision.citations.map((cite: any) => (
                      <li
                        key={cite.id}
                        className="rounded border border-border bg-surface px-2 py-1"
                      >
                        <span className="font-medium text-foreground">{cite.label}</span>{' '}
                        <span className="text-muted-foreground">
                          · grounded {(cite.confidence * 100).toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })
        )}
        {isThinking ? (
          <div className="self-start text-xs text-muted-foreground italic">
            {isStreaming ? 'streaming…' : 'thinking…'}
          </div>
        ) : null}
        {error ? (
          <div className="self-start text-xs text-destructive">error: {error}</div>
        ) : null}
      </div>

      {pendingImages.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {pendingImages.map((f, i) => (
            <span
              key={`${f.name}_${f.size}_${i}`}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-sunken px-3 py-1 text-xs text-foreground"
            >
              <span className="max-w-[14rem] truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => removeImage(i)}
                aria-label={`Remove ${f.name}`}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={isListening ? 'Listening…' : 'Ask your Property Concierge…'}
          disabled={isThinking}
          className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_IMAGE_MIME}
          multiple
          onChange={onPickImages}
          className="hidden"
          aria-label="Attach images"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isThinking || pendingImages.length >= MAX_IMAGES_PER_TURN}
          aria-label="Attach images"
          title={
            pendingImages.length >= MAX_IMAGES_PER_TURN
              ? `Up to ${MAX_IMAGES_PER_TURN} images per turn`
              : 'Attach images (property photo, damage assessment, lease scan)'
          }
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:opacity-50"
        >
          Image
        </button>
        {audioPort?.sttSupported ? (
          <MicButton
            isListening={isListening}
            onStart={startListening}
            onStop={stopListening}
            disabled={isThinking}
          />
        ) : null}
        <button
          type="submit"
          disabled={isThinking || (!draft.trim() && pendingImages.length === 0)}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Send
        </button>
        {isStreaming && isThinking ? (
          <button
            type="button"
            onClick={abortStream}
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

function readBearerFromCookie(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/sb-access-token=([^;]+)/);
  return m ? decodeURIComponent(m[1] ?? '') : '';
}
