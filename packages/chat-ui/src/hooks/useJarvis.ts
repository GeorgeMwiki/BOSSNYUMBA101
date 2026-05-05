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
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  JarvisDecision,
  JarvisStakes,
  JarvisSurfaceClient,
  JarvisThinkRequest,
} from '@bossnyumba/api-sdk';

export interface JarvisTurn {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly decision?: JarvisDecision;
  readonly at: string;
}

export interface UseJarvisOptions {
  readonly client: JarvisSurfaceClient;
  /** Stable thread id; reuse across renders so the kernel keeps memory. */
  readonly threadId: string;
  /** Default stakes for `think()` calls; can be overridden per call. */
  readonly defaultStakes?: JarvisStakes;
  /** Default tier; default = client surface's tier (set by the gateway). */
  readonly defaultTier?: JarvisThinkRequest['tier'];
}

export interface UseJarvisReturn {
  readonly turns: ReadonlyArray<JarvisTurn>;
  readonly status: 'idle' | 'thinking' | 'error';
  readonly error: string | null;
  readonly persona: { id: string; displayName: string; firstPersonNoun: string } | null;
  think(message: string, override?: Partial<JarvisThinkRequest>): Promise<JarvisDecision | null>;
  reset(): void;
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
  const counter = useRef(0);

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

  const reset = useCallback(() => {
    setTurns([]);
    setStatus('idle');
    setError(null);
    setPersona(null);
  }, []);

  return useMemo(
    () => ({ turns, status, error, persona, think, reset }),
    [turns, status, error, persona, think, reset],
  );
}
