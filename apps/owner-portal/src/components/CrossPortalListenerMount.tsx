/**
 * CrossPortalListenerMount — owner-scoped SSE listener.
 *
 * Boots the gateway's `/api/v1/cross-portal/subscribe` channel for the
 * owner-portal (Vite + react-router-dom). Owner operators see tenant-
 * scoped announcements + state-mutation invalidations.
 *
 * Auth: reads the bearer from `localStorage['token']` — same path the
 * api-client + JarvisShell use. Re-arms whenever the token changes via
 * a 60s poll (no AuthContext event-bus exists yet).
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@bossnyumba/design-system';
import {
  startCrossPortalListener,
  type CrossPortalEvent,
  type CrossPortalListenerHandle,
} from '../lib/cross-portal-listener';

const GATEWAY_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const COOKIE_POLL_MS = 60_000;

function readBearer(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem('token') ?? '';
  } catch {
    return '';
  }
}

export function CrossPortalListenerMount(): null {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string>(() => readBearer());
  const handleRef = useRef<CrossPortalListenerHandle | null>(null);
  // Ref tracks the live bearer for the listener's `getToken` callback
  // so reconnects always read the most recent value (closes H-3).
  const tokenRef = useRef<string>(readBearer());

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Polls localStorage; AuthContext doesn't yet emit token change events.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = window.setInterval(() => {
      const next = readBearer();
      setToken((prev) => (prev === next ? prev : next));
    }, COOKIE_POLL_MS);
    return (): void => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!token) return;
    const dispatch = (event: CrossPortalEvent): void => {
      switch (event.kind) {
        case 'announcement':
          toast({
            title: 'Announcement',
            // Closes round-3 M-14: cap server-pushed strings so a
            // runaway emitter cannot pin a screen-filling toast.
            description: String(event.payload.message ?? '').slice(0, 280),
          });
          return;
        case 'notification':
          toast({
            title: String(event.payload.title ?? 'Notification').slice(0, 120),
            description: String(event.payload.message ?? '').slice(0, 280),
          });
          return;
        case 'state-mutation':
          if (Array.isArray(event.payload.queryKey)) {
            void queryClient.invalidateQueries({
              queryKey: event.payload.queryKey as ReadonlyArray<unknown>,
            });
          }
          return;
        case 'wake-trigger':
          toast({
            title: 'Mr. Mwikila is asking for you',
            description: String(event.payload.reason ?? '').slice(0, 280),
          });
          return;
      }
    };

    let handle: CrossPortalListenerHandle | null = null;
    try {
      handle = startCrossPortalListener({
        // round-3 H-3: read the bearer fresh on every reconnect.
        getToken: () => tokenRef.current,
        baseUrl: GATEWAY_BASE_URL,
        onEvent: dispatch,
        onError: (err) => {
          // L-8: escalate to `console.error` so the global Sentry
          // BrowserTracing handler picks the entry up — `console.warn`
          // was being silently de-prioritised.
          // eslint-disable-next-line no-console
          console.error('[cross-portal-listener] owner stream error', {
            err: err instanceof Error ? err.message : String(err),
          });
        },
      });
      handleRef.current = handle;
    } catch (err) {
      // L-8: same — `error` level so observability picks it up.
      // eslint-disable-next-line no-console
      console.error('[cross-portal-listener] owner failed to start', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
    return (): void => {
      try {
        handle?.close();
      } catch {
        // swallow
      }
      handleRef.current = null;
    };
  }, [token, queryClient]);

  return null;
}
