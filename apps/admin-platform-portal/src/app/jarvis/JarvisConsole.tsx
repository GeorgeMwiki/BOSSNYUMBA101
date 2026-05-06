'use client';

/**
 * JarvisConsole — minimal chat console wired into the platform-tier
 * Jarvis surface. Uses the shared `useJarvis` hook and the
 * `createJarvisClient` factory from the api-sdk so every BossNyumba
 * frontend can reuse the same primitive.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createBossnyumbaClient, createJarvisClient } from '@bossnyumba/api-sdk';
import {
  MicButton,
  createWebSpeechAudioPort,
  useJarvis,
  type VoiceAudioPort,
} from '@bossnyumba/chat-ui';

const DEFAULT_GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:4000';

// UI-side cap. The gateway enforces 10 / 4 MiB per attachment as the
// hard server-side limit; the console intentionally caps lower so an HQ
// operator does not staple a presentation deck onto a chat turn.
const MAX_IMAGES_PER_TURN = 5;
const ALLOWED_IMAGE_MIME = 'image/png,image/jpeg,image/gif,image/webp';

export function JarvisConsole(): JSX.Element {
  const [draft, setDraft] = useState('');
  const [threadId] = useState(() => `hq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [pendingImages, setPendingImages] = useState<ReadonlyArray<File>>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Voice port — instantiated only on the client (Web Speech needs `window`).
  const [audioPort, setAudioPort] = useState<VoiceAudioPort | null>(null);
  useEffect(() => {
    setAudioPort(createWebSpeechAudioPort());
  }, []);

  const {
    turns,
    status,
    error,
    persona,
    think,
    thinkWithAttachments,
    reset,
    isListening,
    startListening,
    stopListening,
  } = useJarvis({
    client,
    threadId,
    defaultStakes: 'medium',
    defaultTier: 'industry',
    ...(audioPort ? { voice: { audio: audioPort, speakReplies: true } } : {}),
  });

  function onPickImages(e: React.ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setPendingImages((prev) => {
      // Append, then truncate to the per-turn cap. Existing images are
      // preserved and de-duped by name+size so the same file picked
      // twice doesn't double up.
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
    // Reset the input so picking the same file again still fires onChange.
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeImage(idx: number): void {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const text = draft.trim();
    if (status === 'thinking') return;
    if (!text && pendingImages.length === 0) return;
    setDraft('');
    if (pendingImages.length > 0) {
      const images = pendingImages;
      setPendingImages([]);
      await thinkWithAttachments(text, images);
    } else {
      await think(text);
    }
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
          placeholder={isListening ? 'Listening…' : 'Ask Nyumba Mind…'}
          disabled={status === 'thinking'}
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
          disabled={status === 'thinking' || pendingImages.length >= MAX_IMAGES_PER_TURN}
          aria-label="Attach images"
          title={
            pendingImages.length >= MAX_IMAGES_PER_TURN
              ? `Up to ${MAX_IMAGES_PER_TURN} images per turn`
              : 'Attach images (lease scan, property photo, damage assessment)'
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
            disabled={status === 'thinking'}
          />
        ) : null}
        <button
          type="submit"
          disabled={
            status === 'thinking' ||
            (!draft.trim() && pendingImages.length === 0)
          }
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
