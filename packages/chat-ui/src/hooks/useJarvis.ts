/**
 * useJarvis — React hook for the per-user personal Jarvis surface.
 *
 * Wraps `@bossnyumba/api-sdk`'s `JarvisSurfaceClient` in a stateful
 * React hook that any frontend (customer-app, owner-portal, estate-
 * manager-app, admin-portal, admin-platform-portal) can consume.
 *
 * Each call to `think(message)`:
 *   1. Append a user turn to local thread state
 *   2. Submit to the kernel via the surface client
 *   3. Append the resulting assistant turn (or a refusal placeholder)
 *
 * The hook does NOT manage thread persistence — the api-gateway
 * already records every turn through the kernel's audit chain. The
 * local state is the rendering buffer only.
 *
 * Headless on purpose: layout/styling lives in the calling app.
 *
 * Voice (optional, opt-in via `voice` config):
 *   - Pass a `VoiceAudioPort` (e.g. `createWebSpeechAudioPort()`) to
 *     enable microphone-driven `think()` and (optionally) TTS playback
 *     of every assistant reply.
 *   - All existing return fields are preserved; voice fields are
 *     additive — non-voice callers can ignore them entirely.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  JarvisDecision,
  JarvisStakes,
  JarvisSurfaceClient,
  JarvisThinkRequest,
} from '@bossnyumba/api-sdk';
import type { ListeningHandle, VoiceAudioPort } from '../voice/voice-audio-port.js';

export interface JarvisTurn {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly decision?: JarvisDecision;
  readonly at: string;
}

export interface UseJarvisVoiceOptions {
  /** Audio port (Web Speech API by default; swappable). */
  readonly audio: VoiceAudioPort;
  /**
   * When true, every new assistant turn is automatically spoken via
   * `audio.speak(...)`. The current playback is cancelled if a new
   * turn arrives or the user starts a fresh listening session.
   */
  readonly speakReplies?: boolean;
  /**
   * Reserved for future push-to-talk semantics (hold to record).
   * Currently unused — `startListening`/`stopListening` are toggled
   * explicitly by the calling component.
   */
  readonly pushToTalk?: boolean;
}

export interface UseJarvisOptions {
  readonly client: JarvisSurfaceClient;
  /** Stable thread id; reuse across renders so the kernel keeps memory. */
  readonly threadId: string;
  /** Default stakes for `think()` calls; can be overridden per call. */
  readonly defaultStakes?: JarvisStakes;
  /** Default tier; default = client surface's tier (set by the gateway). */
  readonly defaultTier?: JarvisThinkRequest['tier'];
  /** Optional voice I/O integration (microphone STT + reply TTS). */
  readonly voice?: UseJarvisVoiceOptions;
}

export interface UseJarvisReturn {
  readonly turns: ReadonlyArray<JarvisTurn>;
  readonly status: 'idle' | 'thinking' | 'error';
  readonly error: string | null;
  readonly persona: { id: string; displayName: string; firstPersonNoun: string } | null;
  think(message: string, override?: Partial<JarvisThinkRequest>): Promise<JarvisDecision | null>;
  reset(): void;
  /** True while STT is actively recording. False when no `voice` configured. */
  readonly isListening: boolean;
  /**
   * Begin a microphone-driven turn. On the final transcript the hook
   * automatically calls `think(transcript)`. No-op when `voice` is
   * unset or `audio.sttSupported=false`.
   */
  startListening(): void;
  /** Stop the current listening session without submitting. */
  stopListening(): void;
  /** True while TTS is playing the latest assistant reply. */
  readonly isSpeaking: boolean;
  /** Cancel any in-flight TTS playback immediately. */
  cancelSpeaking(): void;
}

export function useJarvis(opts: UseJarvisOptions): UseJarvisReturn {
  const [turns, setTurns] = useState<ReadonlyArray<JarvisTurn>>([]);
  const [status, setStatus] = useState<'idle' | 'thinking' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<{
    id: string;
    displayName: string;
    firstPersonNoun: string;
  } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const counter = useRef(0);
  const listeningHandleRef = useRef<ListeningHandle | null>(null);
  const speakAbortRef = useRef<AbortController | null>(null);
  const lastSpokenTurnIdRef = useRef<string | null>(null);

  const nextId = useCallback((): string => {
    counter.current += 1;
    return `t_${Date.now()}_${counter.current}`;
  }, []);

  const think = useCallback(
    async (
      message: string,
      override?: Partial<JarvisThinkRequest>,
    ): Promise<JarvisDecision | null> => {
      const trimmed = message.trim();
      if (!trimmed) return null;

      const at = new Date().toISOString();
      const userTurn: JarvisTurn = {
        id: nextId(),
        role: 'user',
        text: trimmed,
        at,
      };
      setTurns((prev) => [...prev, userTurn]);
      setStatus('thinking');
      setError(null);

      const req: JarvisThinkRequest = {
        threadId: opts.threadId,
        userMessage: trimmed,
        stakes: override?.stakes ?? opts.defaultStakes ?? 'medium',
        ...(override?.tier ? { tier: override.tier } : opts.defaultTier ? { tier: opts.defaultTier } : {}),
        ...(typeof override?.requireJudge === 'boolean' ? { requireJudge: override.requireJudge } : {}),
      };

      try {
        const response = await opts.client.think(req);
        setPersona(response.persona);
        const decision = response.decision;
        const text =
          decision.kind === 'refusal'
            ? decision.reason ?? 'I cannot answer that.'
            : decision.text ?? '';
        const assistantTurn: JarvisTurn = {
          id: nextId(),
          role: 'assistant',
          text,
          decision,
          at: new Date().toISOString(),
        };
        setTurns((prev) => [...prev, assistantTurn]);
        setStatus('idle');
        return decision;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus('error');
        setError(message);
        const errorTurn: JarvisTurn = {
          id: nextId(),
          role: 'assistant',
          text: `I hit an error reaching the brain: ${message}`,
          at: new Date().toISOString(),
        };
        setTurns((prev) => [...prev, errorTurn]);
        return null;
      }
    },
    [nextId, opts.client, opts.defaultStakes, opts.defaultTier, opts.threadId],
  );

  // --- Voice: cancel any in-flight TTS. ---
  const cancelSpeaking = useCallback((): void => {
    const audio = opts.voice?.audio;
    if (speakAbortRef.current) {
      speakAbortRef.current.abort();
      speakAbortRef.current = null;
    }
    audio?.cancelSpeech();
    setIsSpeaking(false);
  }, [opts.voice?.audio]);

  // --- Voice: stop the current STT session. ---
  const stopListening = useCallback((): void => {
    if (listeningHandleRef.current) {
      try {
        listeningHandleRef.current.stop();
      } catch {
        /* swallow */
      }
      listeningHandleRef.current = null;
    }
    setIsListening(false);
  }, []);

  // --- Voice: begin an STT session; on final transcript -> think(). ---
  const startListening = useCallback((): void => {
    const voice = opts.voice;
    if (!voice || !voice.audio.sttSupported) return;
    if (listeningHandleRef.current) return; // already listening

    // A fresh user turn cancels any ongoing assistant playback.
    cancelSpeaking();

    let finalText = '';
    try {
      const handle = voice.audio.startListening((r) => {
        if (r.isFinal) {
          finalText = (finalText + ' ' + r.transcript).trim();
        }
      });
      listeningHandleRef.current = {
        stop(): void {
          handle.stop();
          // Submit whatever final text we accumulated.
          const submission = finalText.trim();
          if (submission) {
            void think(submission);
          }
        },
      };
      setIsListening(true);
    } catch (err) {
      console.error('startListening failed', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [opts.voice, cancelSpeaking, think]);

  // --- Voice: speak the latest assistant turn when speakReplies=true. ---
  const speakReplies = opts.voice?.speakReplies ?? false;
  const audioPort = opts.voice?.audio;
  useEffect(() => {
    if (!speakReplies || !audioPort?.ttsSupported) return;
    const last = turns[turns.length - 1];
    if (!last || last.role !== 'assistant') return;
    if (!last.text.trim()) return;
    if (lastSpokenTurnIdRef.current === last.id) return;
    lastSpokenTurnIdRef.current = last.id;

    // Cancel any prior speech and start fresh.
    if (speakAbortRef.current) speakAbortRef.current.abort();
    const ctrl = new AbortController();
    speakAbortRef.current = ctrl;
    setIsSpeaking(true);
    audioPort
      .speak(last.text, { signal: ctrl.signal })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        console.warn('TTS playback failed', err);
      })
      .finally(() => {
        if (speakAbortRef.current === ctrl) speakAbortRef.current = null;
        setIsSpeaking(false);
      });
  }, [turns, speakReplies, audioPort]);

  // Cleanup on unmount.
  useEffect(() => {
    return (): void => {
      if (listeningHandleRef.current) {
        try {
          listeningHandleRef.current.stop();
        } catch {
          /* swallow */
        }
        listeningHandleRef.current = null;
      }
      if (speakAbortRef.current) {
        speakAbortRef.current.abort();
        speakAbortRef.current = null;
      }
      audioPort?.cancelSpeech();
    };
  }, [audioPort]);

  const reset = useCallback(() => {
    setTurns([]);
    setStatus('idle');
    setError(null);
    setPersona(null);
    lastSpokenTurnIdRef.current = null;
    cancelSpeaking();
    stopListening();
  }, [cancelSpeaking, stopListening]);

  return useMemo(
    () => ({
      turns,
      status,
      error,
      persona,
      think,
      reset,
      isListening,
      startListening,
      stopListening,
      isSpeaking,
      cancelSpeaking,
    }),
    [
      turns,
      status,
      error,
      persona,
      think,
      reset,
      isListening,
      startListening,
      stopListening,
      isSpeaking,
      cancelSpeaking,
    ],
  );
}
